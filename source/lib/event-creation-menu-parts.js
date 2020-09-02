const TelegrafInlineMenu = require('telegraf-inline-menu')

const {MONTH_NAMES, DAY_OPTIONS, HOUR_OPTIONS, MINUTE_OPTIONS, generateMonthOptions, generateYearOptions} = require('./event-creation-menu-options')

function addDateSelection(menu, {
  getCurrent,
  setFunc
}, additionalArgs) {
  const regex = /(\d+)-(\d+)-(\d+)T(\d+:\d+)/
  const get = index => {
    return async ctx => {
      const current = await getCurrent(ctx)
      return current.match(regex)[index]
    }
  }

  const set = index => {
    return async (ctx, newValue) => {
      const current = await getCurrent(ctx)
      const match = current.match(regex)
      if (String(newValue).length === 1 && (index === 2 || index === 3)) {
        newValue = '0' + newValue
      }

      match[index] = newValue
      return setFunc(ctx, `${match[1]}-${match[2]}-${match[3]}T${match[4]}`)
    }
  }

  const submenuText = 'Wann findet der Termin statt?'

  menu.submenu(get(3), 'day', new TelegrafInlineMenu(submenuText), {
    ...additionalArgs
  })
    .select('s', DAY_OPTIONS, {
      setParentMenuAfter: true,
      columns: 7,
      setFunc: set(3)
    })

  const monthText = async ctx => MONTH_NAMES[Number(await get(2)(ctx)) - 1]
  menu.submenu(monthText, 'month', new TelegrafInlineMenu(submenuText), {
    joinLastRow: true,
    ...additionalArgs
  })
    .select('s', generateMonthOptions(), {
      setParentMenuAfter: true,
      columns: 3,
      setFunc: set(2)
    })

  menu.submenu(get(1), 'year', new TelegrafInlineMenu(submenuText), {
    joinLastRow: true,
    ...additionalArgs
  })
    .select('s', generateYearOptions(), {
      setParentMenuAfter: true,
      setFunc: set(1)
    })
}

function addQuestionButton(menu, parameter, {
  emoji,
  buttonText,
  questionText,
  uniqueIdentifier,
  getCurrent,
  setFunc
}, additionalArgs = {}) {
  const buttonTextFunc = async ctx => {
    const currentSelection = await getCurrent(ctx, parameter)
    return `${emoji} ${currentSelection || buttonText}`
  }

  menu.question(buttonTextFunc, parameter, {
    questionText,
    uniqueIdentifier,
    setFunc: (ctx, answer) => setFunc(ctx, parameter, answer),
    ...additionalArgs
  })
}

function generateMinuteOptions(minutes) {
  const result = {}
  for (const m of minutes) {
    result[m] = ':' + (m < 10 ? `0${m}` : String(m))
  }

  return result
}

function generateTimeSelectionMenu(text, setFunc, currentFunc) {
  const getCurrent = async ctx => {
    let hour
    let minute
    const current = await currentFunc(ctx)
    if (current) {
      [hour, minute] = current.split(':')
    }

    return {hour, minute}
  }

  const textFunc = async ctx => {
    const userText = typeof text === 'function' ? (await text(ctx)) : text
    const current = await currentFunc(ctx)
    if (!current) {
      return userText
    }

    return `${userText}\n\nDu hast aktuell ${current} gewählt.`
  }

  return new TelegrafInlineMenu(textFunc)
    .select('hour', HOUR_OPTIONS, {
      columns: 5,
      setFunc: async (ctx, key) => {
        const {minute} = await getCurrent(ctx)
        const hour = Number(key) < 10 ? `0${key}` : String(key)
        return setFunc(ctx, `${hour}:${minute || '00'}`)
      },
      isSetFunc: async (ctx, key) => {
        const {hour} = await getCurrent(ctx)
        return Number(hour) === Number(key)
      }
    })
    .select('minute', generateMinuteOptions(MINUTE_OPTIONS), {
      columns: 6,
      setFunc: async (ctx, key) => {
        const {hour} = await getCurrent(ctx)
        const minute = Number(key) < 10 ? `0${key}` : String(key)
        return setFunc(ctx, `${hour || '08'}:${minute}`)
      },
      isSetFunc: async (ctx, key) => {
        const {minute} = await getCurrent(ctx)
        return Number(minute) === Number(key)
      }
    })
}

function addTimeSelectionSubmenu(menu, action, {
  emoji,
  buttonText,
  menuText,
  getCurrentSelection,
  setFunc
}, additionalArgs) {
  const buttonTextFunc = async ctx => {
    const currentSelection = await getCurrentSelection(ctx)
    return `${emoji} ${currentSelection || buttonText}`
  }

  return menu.submenu(buttonTextFunc, action, generateTimeSelectionMenu(menuText, setFunc, getCurrentSelection), additionalArgs)
}

function addStartEndTimeSelectionSubmenu(menu, {
  menuTextStart,
  menuTextEnd,
  getCurrent,
  setFunc
}, additionalArgs = {}) {
  addTimeSelectionSubmenu(menu, 'starttime', {
    emoji: '🕗',
    buttonText: 'Startzeit',
    menuText: menuTextStart,
    getCurrentSelection: ctx => getCurrent(ctx, 'starttime'),
    setFunc: (ctx, newValue) => setFunc(ctx, 'starttime', newValue)
  }, additionalArgs)

  addTimeSelectionSubmenu(menu, 'endtime', {
    emoji: '🕓',
    buttonText: 'Endzeit',
    menuText: menuTextEnd,
    getCurrentSelection: ctx => getCurrent(ctx, 'endtime'),
    setFunc: (ctx, newValue) => setFunc(ctx, 'endtime', newValue)
  }, {
    joinLastRow: true,
    ...additionalArgs
  })
}

module.exports = {
  addDateSelection,
  addQuestionButton,
  addStartEndTimeSelectionSubmenu
}
