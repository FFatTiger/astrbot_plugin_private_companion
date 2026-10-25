"""在回复进入发送链路前清理明显的自重复与自述式重来。

模型偶尔会把同一段落连写两遍，或者在正文里写「等等，格式错了。重来。」这类
元话语——它们会直接被分段发送出去，看起来就像插件重复发送。这里只处理这两种
可判定的形状，不改写正常正文。
"""

from __future__ import annotations

import re

_PARAGRAPH_SPLIT = re.compile(r"\n\s*\n")
_SENTENCE_SPLIT = re.compile(r"(?<=[。！？!?～~…])")
_RETRY_LINE = re.compile(
    r"^(?:等等[，,。.！!]?\s*)?(?:格式|格式错|格式错了|说错|打错|写错)[^\n]{0,16}?"
    r"(?:重来|重新来|重发)[。.!！]?$")
_META_LINE = re.compile(r"^(?:等等[，,。.！!]?\s*)?(?:重来|重新来)[。.!！]?$")


def _collapse(parts, joiner):
    """连续重复的片段只保留一份（去空白后比较）。"""
    result = []
    removed = 0
    for part in parts:
        key = part.strip()
        if key and result and result[-1].strip() == key:
            removed += 1
            continue
        result.append(part)
    return joiner.join(result), removed


def clean_reply_text(text):
    """返回 (清理后的文本, 移除的片段数)。"""
    if not isinstance(text, str) or not text.strip():
        return text, 0
    removed = 0
    lines = []
    for line in text.split("\n"):
        stripped = line.strip()
        if stripped and (_RETRY_LINE.match(stripped) or _META_LINE.match(stripped)):
            removed += 1
            continue
        lines.append(line)
    cleaned = "\n".join(lines).strip()
    paragraphs = _PARAGRAPH_SPLIT.split(cleaned) if cleaned else []
    if paragraphs:
        cleaned, dropped = _collapse(paragraphs, "\n\n")
        removed += dropped
    sentences = _SENTENCE_SPLIT.split(cleaned) if cleaned else []
    if sentences:
        cleaned, dropped = _collapse([item for item in sentences if item], "")
        removed += dropped
    return cleaned.strip(), removed
