#!/usr/bin/env python3
"""
Generate grade2-semester1.json from textbook PDF.
Steps:
1. Define official 识字表 structure (from PDF appendix)
2. Extract sentences from PDF text
3. Generate words for each character
4. Assemble and validate JSON
"""

import json, re, subprocess, os

PDF_PATH = "/home/emaojlu/smilings/learning-buddy/keben/语文 统编版 二年级 上册 2024版.pdf"
OUTPUT_PATH = "/home/emaojlu/smilings/learning-buddy/hanzi-buddy/data/grade2-semester1.json"

# ============================================================
# STEP 1: Official 识字表 structure
# ============================================================

OFFICIAL_STRUCTURE = [
    ("课文1《小蝌蚪找妈妈》", "蝌蚪脑袋灰甩活腿教迎嘴龟披蹲肚鼓"),
    ("课文2《我是什么》", "汽越温滴奔海洋发坏没庄稼屋带灾种管"),
    ("课文3《植物妈妈有办法》", "植如脚旅准备送纷挂挺钻底炸离粗得"),
    ("语文园地一", "朗雾暴雷阵冻夹"),
    ("识字1《场景歌》", "帆港湾塘稻行垂园溪丛翠群队铜号"),
    ("识字2《树之歌》", "榕壮梧桐掌枫松柏桦守银杏杉化桂"),
    ("识字3《拍手歌》", "世界孔雀锦雄鹰翔雁深猛灵休猫"),
    ("识字4《田家四季歌》", "季蝴蝶麦嫩肥农勤归戴场谷虽辛苦制"),
    ("语文园地二", "丑恨诚虚假漠助贫富饥"),
    ("课文4《彩虹》", "虹浇壶提洒挑镜拿系荡裙"),
    ("课文5《去外婆家》", "婆候趣舅或留份喂逃曲者服扑鼻"),
    ("课文6《数星星的孩子》", "珍撒碧靠仰颗距变祖勺绕转楚汉刻研"),
    ("语文园地三", "弹钢琴捏泥围滚铁环滑梯"),
    ("课文7《古诗二首》", "登唐依尽欲穷层瀑布炉紫烟遥闻景区省秀神仙盘指巨伸都著"),
    ("课文8《黄山奇石》", "抢状岩"),
    ("课文9《日月潭》", "潭茂盛胜央岛隐约倒映整童吸引客"),
    ("课文10《葡萄沟》", "葡萄沟坡密枝淡好族够收市干钉分颜味"),
    ("语文园地四", "订效丰昌付卧铺改签退更维码"),
    ("课文11《坐井观天》", "观沿渴话弄错际抬信"),
    ("课文12《寒号鸟》", "号当鹊寻枯却劝刮死将且狂冷重复哀唤"),
    ("课文13《我要的是葫芦》", "葫芦谢以盯赛怪慢"),
    ("语文园地五", "轿救摩托防渔货科考察"),
    ("课文14《八角楼上》", "楼艰斗代临腊军薄章握凝觉油辉革命利"),
    ("课文15《朱德的扁担》", "朱德扁担同志伍敌根据抽陡鞋疼敬"),
    ("课文16《难忘的泼水节》", "泼民度特周恩敲铺龙串容踩始盛碗祝寿"),
    ("课文17《刘胡兰》", "刘兰派由于卖员捕买似踏烈荣岁题"),
    ("语文园地六", "锋蜜峰蜂爆争抄炒幕墓慕"),
    ("课文18《古诗二首》", "绝径踪灭舟钓似庐笼盖苍茫"),
    ("课文19《雾在哪里》", "论暗岸街梁甚至切躲该悠闲散失"),
    ("课文20《雪孩子》", "堆累添柴烧旺闭哎旁冲哇终浑淋晒"),
    ("语文园地七", "漱饿沼泽宁杠杆栋库闸羔蝗"),
    ("课文21《称赞》", "称赞刺猬板凳但极傍苹泄接除疲劳"),
    ("课文22《纸船和风筝》", "筝鼠折漂扎乘抓线莓俩架受愿朝取"),
    ("课文23《快乐的小河》", "撞怨软呜慈祥量跌摔擦咱推驶坚硬"),
    ("语文园地八", "狼猩鹤蛇鸽蚕蚯蚓骆驼狮"),
]

# ============================================================
# STEP 2: Extract sentences from PDF
# ============================================================

def extract_sentences_from_pdf(pdf_path):
    """Extract all usable sentences from the textbook PDF."""
    subprocess.run(['pdftotext', pdf_path, '/tmp/g2s1_raw.txt'],
                   capture_output=True, text=True)
    
    with open('/tmp/g2s1_raw.txt', 'r', encoding='utf-8') as f:
        raw = f.read()
    
    # Remove spaces between Chinese characters
    cleaned_lines = []
    for line in raw.split('\n'):
        no_space = line.replace(' ', '').replace('\t', '')
        cn_count = sum(1 for c in no_space if '\u4e00' <= c <= '\u9fff')
        if cn_count >= 3:
            # Remove pinyin remnants
            no_space = re.sub(r'[a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+', '', no_space)
            cleaned_lines.append(no_space)
    
    # Extract sentences (split by punctuation)
    sentences = set()
    for line in cleaned_lines:
        # Split by sentence-ending and clause punctuation
        parts = re.split(r'([。！？；])', line)
        current = ''
        for part in parts:
            current += part
            if part in '。！？；':
                s = current.strip().strip('""\u201c\u201d""''《》')
                cn_count = sum(1 for c in s if '\u4e00' <= c <= '\u9fff')
                if 3 <= cn_count <= 30:
                    sentences.add(s)
                current = ''
        
        # Also extract comma-separated clauses
        comma_parts = re.split(r'([，,])', line)
        current = ''
        for part in comma_parts:
            current += part
            if part in '，,':
                s = current.strip().strip('""\u201c\u201d""''')
                cn_count = sum(1 for c in s if '\u4e00' <= c <= '\u9fff')
                if 4 <= cn_count <= 25:
                    sentences.add(s)
                current = ''
    
    return list(sentences)


def build_sentence_index(sentences):
    """Build char -> list of sentences lookup."""
    index = {}
    for sent in sentences:
        for char in set(sent):
            if '\u4e00' <= char <= '\u9fff':
                if char not in index:
                    index[char] = []
                index[char].append(sent)
    return index


def find_best_sentence(char, sentence_index):
    """Find the best (shortest valid) sentence for a character."""
    sents = sentence_index.get(char, [])
    if not sents:
        return ""
    
    # Filter: must contain the char, prefer shorter
    valid = [(sum(1 for c in s if '\u4e00' <= c <= '\u9fff'), s) for s in sents if char in s]
    if not valid:
        return ""
    
    # Sort by length, prefer 5-20 char sentences
    valid.sort(key=lambda x: abs(x[0] - 10))
    return valid[0][1]


# ============================================================
# STEP 3: Pinyin and Words data
# ============================================================

# Load pinyin data from the existing skeleton file
def load_existing_pinyin():
    """Load pinyin from the existing grade2-semester1.json skeleton."""
    try:
        with open(OUTPUT_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        pinyin_map = {}
        for lesson in data.get('lessons', []):
            for entry in lesson.get('chars', []):
                char = entry['char']
                pinyin = entry.get('pinyin', '')
                if pinyin and pinyin != '?':
                    if char not in pinyin_map:
                        pinyin_map[char] = []
                    pinyin_map[char].append(pinyin)
        return pinyin_map
    except:
        return {}

# Comprehensive pinyin dictionary for Grade 2 Semester 1 characters
PINYIN_DATA = None  # Will be loaded from file in step 3b

def load_pinyin_data():
    """Load from pinyin data file."""
    path = '/home/emaojlu/smilings/learning-buddy/hanzi-buddy/scripts/g2s1_pinyin.json'
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


# ============================================================
# STEP 4: Word generation
# ============================================================

WORDS_DATA = None  # Will be loaded from file

def load_words_data():
    """Load from words data file."""
    path = '/home/emaojlu/smilings/learning-buddy/hanzi-buddy/scripts/g2s1_words.json'
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


# ============================================================
# STEP 5: Assemble JSON
# ============================================================

def generate():
    """Main generation function."""
    print("Extracting sentences from PDF...")
    sentences = extract_sentences_from_pdf(PDF_PATH)
    print(f"  Extracted {len(sentences)} sentences")
    
    sentence_index = build_sentence_index(sentences)
    
    print("Loading pinyin data...")
    pinyin_data = load_pinyin_data()
    existing_pinyin = load_existing_pinyin()
    
    print("Loading words data...")
    words_data = load_words_data()
    
    # Assemble lessons
    lessons = []
    total_chars = 0
    missing_pinyin = []
    missing_words = []
    missing_sentences = []
    
    for seq, (title, chars_str) in enumerate(OFFICIAL_STRUCTURE, 1):
        chars_list = list(chars_str)
        entries = []
        
        for char in chars_list:
            # Get pinyin
            pinyin = pinyin_data.get(char, '')
            if not pinyin:
                pinyins = existing_pinyin.get(char, [])
                pinyin = pinyins[0] if pinyins else ''
            if not pinyin:
                missing_pinyin.append(char)
                pinyin = ''
            
            # Get words
            words = words_data.get(char, [])
            if len(words) < 2:
                missing_words.append(char)
                words = words + [''] * (2 - len(words))
            words = words[:2]
            
            # Get sentence
            sentence = find_best_sentence(char, sentence_index)
            if not sentence:
                missing_sentences.append(char)
            
            entries.append({
                "char": char,
                "pinyin": pinyin,
                "words": words,
                "sentence": sentence
            })
        
        lessons.append({
            "id": f"2-1-{seq}",
            "title": title,
            "chars": entries
        })
        total_chars += len(entries)
    
    output = {"grade": 2, "semester": 1, "lessons": lessons}
    
    # Report
    print(f"\nGenerated: {len(lessons)} lessons, {total_chars} chars")
    print(f"Missing pinyin: {len(missing_pinyin)}")
    print(f"Missing words: {len(missing_words)}")
    print(f"Missing sentences: {len(missing_sentences)}")
    
    if missing_pinyin:
        print(f"  Pinyin needed: {''.join(missing_pinyin[:50])}")
    if missing_words:
        print(f"  Words needed: {''.join(missing_words[:50])}")
    
    # Write output
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ Written to {OUTPUT_PATH}")
    return missing_pinyin, missing_words, missing_sentences


if __name__ == '__main__':
    generate()
