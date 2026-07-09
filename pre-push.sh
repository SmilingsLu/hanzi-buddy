#!/bin/bash
# ============================================
# HanziGo Pre-Push Check
# Run this before pushing: ./pre-push.sh
# Or set as git hook (see below)
# ============================================

cd "$(dirname "$0")"
echo "🧪 Running HanziGo pre-push checks..."
echo "=================================================="

# Run Python test suite
python3 -c "
import json, re, os

passed = 0
failed = 0
errors = []

def test(name, condition, error_msg=''):
    global passed, failed, errors
    if condition:
        passed += 1
    else:
        failed += 1
        errors.append(f'  ❌ {name} — {error_msg}')

# 1. Data files
all_chars = []
for grade in range(1, 10):
    for sem in [1, 2]:
        fname = f'data/grade{grade}-semester{sem}.json'
        if not os.path.exists(fname): continue
        with open(fname) as f: data = json.load(f)
        for lesson in data['lessons']:
            for c in lesson['chars']:
                all_chars.append(c)

test('Data: chars loaded', len(all_chars) > 100, f'Only {len(all_chars)}')
missing = sum(1 for c in all_chars if not c.get('char') or len(c['char'])!=1 or not c.get('pinyin') or not c.get('words') or not c.get('sentence'))
test('Data: all fields present', missing == 0, f'{missing} chars with missing fields')
not_in_sent = sum(1 for c in all_chars if c['char'] not in c.get('sentence',''))
test('Data: char in sentence', not_in_sent == 0, f'{not_in_sent} chars not in sentence')

# 2. HTML IDs
with open('index.html') as f: html = f.read()
critical_ids = ['flashcard','cardChar','favBtn','btnPrev','btnNext','btnFlip','btnSpeak','btnReinforce','learnMode','challengeMode','lessonFilter','quizTypeSelector','quizOptions','btnPlayAgain','streakNumber','btnProfile','btnFavorites','btnErrorBook','btnBadges','sidebar']
html_ids = set(re.findall(r'id=\"([^\"]+)\"', html))
missing_ids = [i for i in critical_ids if i not in html_ids]
test('HTML: critical IDs', len(missing_ids)==0, f'Missing: {missing_ids}')

# 3. JS syntax (braces balanced)
for f in ['js/constants.js','js/state.js','js/data.js','js/services.js','js/ui.js','js/controllers.js']:
    with open(f) as fh: js = fh.read()
    test(f'JS: {f} braces', js.count('{')==js.count('}'), f'{js.count(\"{\")} vs {js.count(\"}\")}')

# 4. Dynamic HTML IDs
with open('js/controllers.js') as f: ctrl = f.read()
dynamic_ids = set(re.findall(r'id=\"([^\"]+)\"', ctrl))
dyn_critical = ['flashcard','cardChar','btnPrev','btnNext','btnFlip','btnSpeak','btnReinforce','lessonFilter','quizTypeSelector']
missing_dyn = [i for i in dyn_critical if i not in dynamic_ids]
test('JS: dynamic HTML IDs', len(missing_dyn)==0, f'Missing: {missing_dyn}')

# 5. No dead code
all_js = ''
for f in ['js/constants.js','js/state.js','js/data.js','js/services.js','js/ui.js','js/controllers.js']:
    with open(f) as fh: all_js += fh.read()
dead = ['semesterStrip','favCardCount','errCardCount','lessonIndicator','flipHint','btnRandom','_showShuffleFeedback']
found_dead = [r for r in dead if r in all_js]
test('Clean: no dead refs', len(found_dead)==0, f'Found: {found_dead}')
test('Clean: no console.log', all_js.count('console.log')==0, f'{all_js.count(\"console.log\")} found')

# 6. Badges
with open('js/services.js') as f: svc = f.read()
badge_ids = re.findall(r\"id: '([^']+)'\", svc)
test('Badges: 5 defined', len(badge_ids)==5, f'Found {len(badge_ids)}')

# 7. Config valid
test('Config: valid JSON', True if json.load(open('config.json')) else False)

# Report
print()
if errors:
    for e in errors: print(e)
print()
print(f'Results: {passed} passed, {failed} failed')
if failed > 0:
    print('❌ FIX ISSUES BEFORE PUSHING')
    exit(1)
else:
    print('✅ All checks passed — safe to push!')
    exit(0)
"

EXIT_CODE=$?
echo "=================================================="
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Ready to push!"
else
    echo "❌ Fix the issues above before pushing."
    exit 1
fi
