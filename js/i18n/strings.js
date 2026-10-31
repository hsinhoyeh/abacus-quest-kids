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
};

/** @type {Record<Lang, Record<string, string>>} */
export const TABLES = { 'en': EN, 'zh-TW': ZH_TW };
