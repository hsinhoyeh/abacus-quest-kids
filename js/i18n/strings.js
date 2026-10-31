// Every user-visible string in the app, in English and Traditional Chinese
// (zh-TW, for an ~8-year-old reader: short, simple words). Flat keys;
// `{name}` placeholders are filled by t(key, vars). The zh-TW table is written
// first and js/i18n/zhuyin.js is scoped to it: test/i18n.coverage.test.js fails
// if any Han character here has no zhuyin reading.
// Keys must match between the two tables (enforced by test/i18n.test.js).

/** @typedef {import('../types.js').Lang} Lang */

/** @type {Record<string, string>} */
export const EN = {
  // App shell
  'brand': 'Abacus Quest',
  'note': 'Unofficial fan-style project; not affiliated with Mojang or Microsoft.',
  'nav.map': 'Map',
  'nav.parent': 'Parents',
  'nav.player': 'Player: {name}',
  'nav.xp': '{xp} XP',
  'nav.lang': 'Language',
  'nav.langEn': 'EN',
  'nav.langZh': '中文',
  'nav.soundOn': 'Sound on',
  'nav.soundOff': 'Sound off',
  'best': 'Best {time}',
  'storageWarning': 'This browser is not saving progress (private mode?). Play still works.',

  // Pack titles (Pack.titleKey)
  'pack.set1': 'Place it: 1 digit',
  'pack.set2': 'Place it: 2 digits',
  'pack.set3': 'Place it: 3-4 digits',
  'pack.addsub1': 'Mine: no carry',
  'pack.addsub2': 'Mine: carry',
  'pack.addsub3': 'Mine: borrow',
  'pack.addsub4': 'Mine: 2-digit mix',

  // Map
  'map.title': 'Mine map',
  'map.depth.1': 'Surface',
  'map.depth.2': 'Cave',
  'map.depth.3': 'Deep Mine',
  'map.depth.4': 'Nether',
  'map.depth.5': 'End',
  'map.depthFallback': 'Depth {n}',
  'map.noPacks': 'Nothing here yet',
  'map.locked': 'Locked',
  'map.requirement': 'Earn {stars} stars in {depth} to unlock',
  'map.starsLabel': '{n} of 3 stars',

  // Parent screen
  'parent.title': 'Progress for {player}',
  'parent.summary': 'This week: {sessions} sessions, {accuracy} correct, {median} per problem',
  'parent.sessions': 'Sessions this week: {n}',
  'parent.accuracy': 'Accuracy: {pct}',
  'parent.median': 'Median time per problem: {sec} s',
  'parent.empty': 'No plays this week',
  'parent.noPlayer': 'Player',

  // Player picker
  'picker.title': 'Who is playing?',
  'picker.placeholder': 'New nickname',
  'picker.inputLabel': 'Nickname',
  'picker.add': 'Add',
  'picker.error.empty': 'Please type a nickname.',
  'picker.error.duplicate': 'That nickname is taken.',
  'picker.error.reserved': 'Please pick a different nickname.',

  // Result screen
  'result.doneTitle': 'Level cleared!',
  'result.overTitle': 'Out of hearts!',
  'result.xp': '+{xp} XP',
  'result.time': 'Time: {time}',
  'result.starsLabel': '{n} of 3 stars',
  'result.newRecord': 'New record!',
  'result.retry': 'Try again',
  'result.next': 'Next',

  // Add/subtract level
  'level.mine': 'Mine!',
  'level.skip': 'Skip',
  'level.retry': 'Try again',
  'level.correct': 'Correct! +{xp} XP',
  'level.speed': '\u26A1+{bonus} speed',
  'level.streak': '{n} in a row!',
  'level.wrong': 'Not quite: it was {target}. -1 heart',
  'level.skipped': 'Skipped',
  'level.timeout': 'Boom! The fuse ran out. -1 heart',
  'level.over': 'Out of hearts! Try again?',
  'level.done': 'Level cleared!',
  'level.hearts': '{n} hearts',
  'level.xp': 'XP {xp}',

  // Set-the-number level
  'set.check': 'Check',
  'set.progress': 'Level {n} of {total}',
  'set.correct': 'Correct! Nice placing!',
  'set.retry': 'Almost! Have another look and try again.',
  'set.done': 'All set! Great warm-up!',

  // Fuse widget and soroban
  'fuse.start': 'Start!',
  'fuse.elapsed': 'elapsed time',
  'fuse.record': 'New record!',
  'soroban.clear': 'Clear',
  'soroban.heaven': 'heaven bead',
  'soroban.earth': 'earth bead {k}',

  // Learn: map section and lesson titles (Lesson.titleKey)
  'learn.title': 'Learn',
  'learn.borrowGroup': 'Borrowing',
  'learn.done': 'Done',
  'lesson.basics': 'Add and take away: the basics',
  'lesson.complement5': 'Complement of 5',
  'lesson.carry': 'Carrying: 7 + 5',
  'lesson.borrow1': 'Borrow 1: 12 - 5',
  'lesson.borrow2': 'Borrow 2: 21 - 8',
  'lesson.borrow3': 'Borrow 3: 100 - 7, zeros in between',
  'lesson.borrow4': 'Borrow 4: mixed, 53 - 28',

  // Lesson screen
  'lesson.back': 'Back to map',
  'lesson.example': 'Example',
  'lesson.practice': 'Practice {n} of {total}',
  'lesson.start': 'Start practice',
  'lesson.nextProblem': 'Next problem',
  'lesson.finish': 'Finish',
  'lesson.complete': 'Lesson complete!',
  'lesson.next': 'Next lesson',
  'lesson.allDone': 'You finished every lesson!',

  // Tutorial: the rule for each kind of step (keys from core/explain.js KEYS)
  'tut.direct.add': 'Add {digit} on the {place} rod.',
  'tut.direct.remove': 'Take away {digit} on the {place} rod.',
  'tut.c5.add': 'Not enough lower beads. On the {place} rod add 5, then take away {complement}.',
  'tut.c5.remove': 'On the {place} rod take away 5, then add back {complement}.',
  'tut.carry.remove': '{digit} will not fit on the {place} rod. Take away {amount} here first, then carry 1 to the left.',
  'tut.carry.remove.c5': '{digit} will not fit on the {place} rod. Take away {amount} here first, using the 5 bead. Then carry 1 to the left.',
  'tut.carry.ripple': 'The {place} rod is full. Clear it back to 0 and carry on to the left.',
  'tut.carry.add': 'Now add 1 on the {place} rod. That is the 10 we carried!',
  'tut.carry.add.c5': 'Now add 1 on the {place} rod, using the 5 bead. That is the 10 we carried!',
  'tut.borrow.take': 'Not enough to take away {digit}! Borrow 1 from the {fromPlace} on the left. It is worth 10.',
  'tut.borrow.take.c5': 'Not enough to take away {digit}! Borrow 1 from the {fromPlace} on the left, using the 5 bead. It is worth 10.',
  'tut.borrow.nine': 'The {place} is 0, so it has nothing to lend. Make it 9 and pass the 10 along.',
  'tut.borrow.add': 'Now add {amount} on the {place} rod, because 10 - {digit} = {amount}.',
  'tut.borrow.add.c5': 'Now add {amount} on the {place} rod, using the 5 bead, because 10 - {digit} = {amount}.',

  // Tutorial: place names for {place}, {fromPlace}, {toPlace}
  'tut.place.ones': 'ones',
  'tut.place.tens': 'tens',
  'tut.place.hundreds': 'hundreds',
  'tut.place.thousands': 'thousands',
  'tut.place.tenThousands': 'ten-thousands',
  // Short captions under the rods of the tutorial soroban
  'tut.label.ones': '1s',
  'tut.label.tens': '10s',
  'tut.label.hundreds': '100s',
  'tut.label.thousands': '1000s',
  'tut.label.tenThousands': '10000s',

  // Tutorial: buttons and feedback
  'tut.progress': 'Step {n} of {total}',
  'tut.showMe': 'Show me',
  'tut.yourTurn': 'Your turn',
  'tut.again': 'Try again',
  'tut.next': 'Next',
  'tut.back': 'Back',
  'tut.replay': 'Replay',
  'tut.undo': 'Undo',
  'tut.good': 'Nice! That is right.',
  'tut.hint': 'Almost! Look at the glowing beads and try again.',
  'tut.done': 'You did it! Great job!',
  'tut.modeShow': 'Watch',
  'tut.modeTry': 'You try',
};

/** @type {Record<string, string>} */
export const ZH_TW = {
  // App shell
  'brand': '算盤冒險',
  'note': '這是粉絲風格的小遊戲，跟 Mojang、Microsoft 都沒有關係。',
  'nav.map': '地圖',
  'nav.parent': '家長',
  'nav.player': '玩家：{name}',
  'nav.xp': '{xp} 經驗',
  'nav.lang': '語言',
  'nav.langEn': 'EN',
  'nav.langZh': '中文',
  'nav.soundOn': '聲音：開',
  'nav.soundOff': '聲音：關',
  'best': '最快 {time}',
  'storageWarning': '這裡沒辦法存下你的進度，不過還是可以玩喔！',

  // Pack titles
  'pack.set1': '擺數字：1 位數',
  'pack.set2': '擺數字：2 位數',
  'pack.set3': '擺數字：3 到 4 位數',
  'pack.addsub1': '挖礦：不進位',
  'pack.addsub2': '挖礦：進位',
  'pack.addsub3': '挖礦：借位',
  'pack.addsub4': '挖礦：2 位數混合',

  // Map
  'map.title': '礦坑地圖',
  'map.depth.1': '地表',
  'map.depth.2': '洞穴',
  'map.depth.3': '深礦',
  'map.depth.4': '地獄',
  'map.depth.5': '終界',
  'map.depthFallback': '第 {n} 層',
  'map.noPacks': '這裡還沒有東西',
  'map.locked': '鎖住了',
  'map.requirement': '在{depth}拿到 {stars} 顆星就能打開',
  'map.starsLabel': '3 顆星裡有 {n} 顆',

  // Parent screen
  'parent.title': '{player} 的學習紀錄',
  'parent.summary': '這一週：玩了 {sessions} 次，答對 {accuracy}，每題 {median}',
  'parent.sessions': '這一週玩了 {n} 次',
  'parent.accuracy': '答對率：{pct}',
  'parent.median': '每題時間（中位數）：{sec} 秒',
  'parent.empty': '這一週還沒有玩',
  'parent.noPlayer': '玩家',

  // Player picker
  'picker.title': '誰要玩？',
  'picker.placeholder': '新的名字',
  'picker.inputLabel': '名字',
  'picker.add': '加入',
  'picker.error.empty': '請打一個名字。',
  'picker.error.duplicate': '這個名字有人用了。',
  'picker.error.reserved': '請換一個名字。',

  // Result screen
  'result.doneTitle': '過關了！',
  'result.overTitle': '愛心用完了！',
  'result.xp': '+{xp} 經驗',
  'result.time': '時間：{time}',
  'result.starsLabel': '3 顆星裡有 {n} 顆',
  'result.newRecord': '新紀錄！',
  'result.retry': '再試一次',
  'result.next': '下一關',

  // Add/subtract level
  'level.mine': '挖！',
  'level.skip': '跳過',
  'level.retry': '再試一次',
  'level.correct': '答對了！+{xp} 經驗',
  'level.speed': '\u26A1速度 +{bonus}',
  'level.streak': '連續答對 {n} 題！',
  'level.wrong': '差一點：答案是 {target}。-1 顆愛心',
  'level.skipped': '跳過了',
  'level.timeout': '轟！導火線燒完了。-1 顆愛心',
  'level.over': '愛心用完了！再試一次嗎？',
  'level.done': '過關了！',
  'level.hearts': '{n} 顆愛心',
  'level.xp': '經驗 {xp}',

  // Set-the-number level
  'set.check': '檢查',
  'set.progress': '第 {n} 關，共 {total} 關',
  'set.correct': '答對了！擺得真好！',
  'set.retry': '差一點！再看看，再試一次。',
  'set.done': '全部完成！暖身做得真好！',

  // Fuse widget and soroban
  'fuse.start': '開始！',
  'fuse.elapsed': '已經過的時間',
  'fuse.record': '新紀錄！',
  'soroban.clear': '清除',
  'soroban.heaven': '上面的珠子',
  'soroban.earth': '下面的珠子 {k}',

  // Learn: map section and lesson titles
  'learn.title': '學習',
  'learn.borrowGroup': '借位',
  'learn.done': '完成了',
  'lesson.basics': '加減入門',
  'lesson.complement5': '5 的補數',
  'lesson.carry': '進位：7 + 5',
  'lesson.borrow1': '借位 1：12 - 5',
  'lesson.borrow2': '借位 2：21 - 8',
  'lesson.borrow3': '借位 3：100 - 7，中間有 0',
  'lesson.borrow4': '借位 4：混合，53 - 28',

  // Lesson screen
  'lesson.back': '回地圖',
  'lesson.example': '範例',
  'lesson.practice': '練習 {n} / {total}',
  'lesson.start': '開始練習',
  'lesson.nextProblem': '下一題',
  'lesson.finish': '完成',
  'lesson.complete': '這一課完成了！',
  'lesson.next': '下一課',
  'lesson.allDone': '全部的課都完成了！',

  // Tutorial: the rule for each kind of step
  'tut.direct.add': '在{place}加 {digit}。',
  'tut.direct.remove': '在{place}減 {digit}。',
  'tut.c5.add': '下面的珠子不夠了。在{place}先加 5，再減 {complement}。',
  'tut.c5.remove': '在{place}先減 5，再加回 {complement}。',
  'tut.carry.remove': '{place}不夠加 {digit}。先在這裡減 {amount}，再向左邊進 1。',
  'tut.carry.remove.c5': '{place}不夠加 {digit}。先在這裡減 {amount}，要用到上面的珠子。再向左邊進 1。',
  'tut.carry.ripple': '{place}滿了，變回 0，再往左邊進 1。',
  'tut.carry.add': '然後在{place}加 1，這就是進位來的 10！',
  'tut.carry.add.c5': '然後在{place}加 1，要用到上面的珠子。這就是進位來的 10！',
  'tut.borrow.take': '不夠減{digit}，向左邊的{fromPlace}借 1，借來的 1 等於 10。',
  'tut.borrow.take.c5': '不夠減{digit}，向左邊的{fromPlace}借 1，要用到上面的珠子，借來的 1 等於 10。',
  'tut.borrow.nine': '{place}是 0，沒東西可借，變成 9，把借來的 10 傳下去。',
  'tut.borrow.add': '然後在{place}加 {amount}，因為 10 - {digit} = {amount}。',
  'tut.borrow.add.c5': '然後在{place}加 {amount}，要用到上面的珠子，因為 10 - {digit} = {amount}。',

  // Tutorial: place names
  'tut.place.ones': '個位',
  'tut.place.tens': '十位',
  'tut.place.hundreds': '百位',
  'tut.place.thousands': '千位',
  'tut.place.tenThousands': '萬位',
  'tut.label.ones': '個位',
  'tut.label.tens': '十位',
  'tut.label.hundreds': '百位',
  'tut.label.thousands': '千位',
  'tut.label.tenThousands': '萬位',

  // Tutorial: buttons and feedback
  'tut.progress': '第 {n} / {total} 步',
  'tut.showMe': '看我做',
  'tut.yourTurn': '換你做',
  'tut.again': '再試一次',
  'tut.next': '下一步',
  'tut.back': '上一步',
  'tut.replay': '重看',
  'tut.undo': '重來',
  'tut.good': '做對了！很好！',
  'tut.hint': '差一點！看看發亮的珠子，再試一次。',
  'tut.done': '你做到了！好棒！',
  'tut.modeShow': '看',
  'tut.modeTry': '你來試',
};

/** @type {Record<Lang, Record<string, string>>} */
export const TABLES = { 'en': EN, 'zh-TW': ZH_TW };
