const TelegrafInlineMenu = require('telegraf-inline-menu')
const arrayFilterUnique = require('array-filter-unique')

const allEvents = require('../lib/all-events')
const {formatDateToHumanReadable} = require('../lib/calendar-helper')
const {
  loadEvents,
  generateChangeText
} = require('../lib/change-helper')
const {
  addDateSelection,
  addQuestionButton,
  addStartEndTimeSelectionSubmenu
} = require('../lib/event-creation-menu-parts')

const changeDetails = require('./change-details')

const menu = new TelegrafInlineMenu(addChangeMenuText)

function changesOfEvent(ctx, name) {
  const allChanges = ctx.state.userconfig.changes
  return allChanges.filter(o => o.name === name)
}

function addChangeMenuText(ctx) {
  const {name, date, add} = ctx.session.generateChange ?? {}
  let text = ''
  if (!name) {
    return 'Zu welcher Veranstaltung willst du eine Änderung hinzufügen?'
  }

  if (!date) {
    text = 'Zu welchem Termin willst du eine Änderung hinzufügen?'
    const changes = changesOfEvent(ctx, name)
    if (changes.length > 0) {
      text += '\n\nFolgende Termine habe bereits eine Veränderung. Entferne die Veränderung zuerst, bevor du eine neue erstellen kannst.'
      text += '\n'

      const dates = changes.map(o => o.date)
      dates.sort()
      text += dates
        .map(o => formatDateToHumanReadable(o))
        .map(o => `- ${o}`)
        .join('\n')
    }
  }

  if (date) {
    text = generateChangeText(ctx.session.generateChange)
    if (add) {
      text += '\nSpezifiziere den zusätzlichen Termin.'
    } else {
      text += '\nWelche Art von Änderung willst du vornehmen?'
    }
  }

  return text
}

function hidePickEventStep(ctx) {
  if (!ctx.session.generateChange) {
    ctx.session.generateChange = {}
  }

  return ctx.session.generateChange.name
}

function hidePickDateStep(ctx) {
  const {name, date} = ctx.session.generateChange ?? {}
  return !name || date
}

function hideGenerateChangeStep(ctx) {
  const {name, date} = ctx.session.generateChange ?? {}
  return !name || !date
}

function hideGenerateAddStep(ctx) {
  const {name, date, add} = ctx.session.generateChange ?? {}
  return !name || !date || !add
}

function generationDataIsValid(ctx) {
  const keys = Object.keys(ctx.session.generateChange ?? [])
  // Required (2): name and date
  // There have to be other changes than that in order to do something.
  return keys.length > 2
}

menu.select('event', ctx => ctx.state.userconfig.events, {
  columns: 2,
  getCurrentPage: ctx => ctx.session.page,
  setPage: (ctx, page) => {
    ctx.session.page = page
  },
  hide: hidePickEventStep,
  setFunc: async (ctx, key) => {
    if (await allEvents.exists(key)) {
      ctx.session.generateChange.name = key
    } else {
      ctx.state.userconfig.events = ctx.state.userconfig.events
        .filter(o => o !== key)
      await ctx.answerCbQuery(`⚠️ Die Veranstaltung "${key}" existiert garnicht mehr!\nIch habe sie aus deinem Kalender entfernt.`, true)
    }
  }
})

menu.button('➕ Zusätzlicher Termin', 'new-date', {
  hide: hidePickDateStep,
  doFunc: ctx => {
    const now = new Date()
      .toISOString()
      .replace(/:\d{2}.\d{3}Z/, '')
    // Set everything that has to be set to be valid.
    // When the user dont like the data he can change it but he is not able to create invalid data.
    ctx.session.generateChange.add = true
    ctx.session.generateChange.date = now
    ctx.session.generateChange.starttime = now.split('T')[1]
    ctx.session.generateChange.endtime = '23:45'
  }
})

async function possibleTimesToCreateChangeToOptions(ctx) {
  const name = ctx.session.generateChange && ctx.session.generateChange.name
  if (!name) {
    // No event selected for which events could be found
    return []
  }

  if (ctx.session.generateChange.date) {
    // Date already selected
    return []
  }

  const existingChangeDates = new Set(changesOfEvent(ctx, name)
    .map(o => o.date))

  const events = await loadEvents(name, 'utf8')
  const dates = events
    .map(o => o.StartTime)
    .map(o => o.toISOString().replace(':00.000Z', ''))
    .filter(o => !existingChangeDates.has(o))
    .filter(arrayFilterUnique())
  const options = {}
  for (const date of dates) {
    options[date.replace(':', '!')] = formatDateToHumanReadable(date)
  }

  return options
}

menu.select('date', possibleTimesToCreateChangeToOptions, {
  columns: 2,
  hide: hidePickDateStep,
  setFunc: (ctx, key) => {
    ctx.session.generateChange.date = key.replace('!', ':')
  }
})

menu.simpleButton('🚫 Entfällt', 'remove', {
  doFunc: ctx => {
    ctx.session.generateChange.remove = true
    return finish(ctx)
  },
  hide: ctx => {
    if (hideGenerateChangeStep(ctx)) {
      return true
    }

    return Object.keys(ctx.session.generateChange).length > 2
  }
})

function generalGet(ctx, parameter) {
  return ctx.session.generateChange[parameter]
}

function generalSet(ctx, parameter, newValue) {
  if (parameter === 'starttime' && ctx.session.generateChange.add) {
    const date = ctx.session.generateChange.date.split('T')[0]
    ctx.session.generateChange.date = `${date}T${newValue}`
  }

  ctx.session.generateChange[parameter] = newValue
}

addDateSelection(menu, {
  getCurrent: ctx => ctx.session.generateChange.date,
  setFunc: (ctx, newValue) => {
    ctx.session.generateChange.date = newValue
  }
}, {
  hide: hideGenerateAddStep
})

addStartEndTimeSelectionSubmenu(menu, {
  menuTextStart: 'Zu welchem Zeitpunkt beginnt diese Veranstaltung stattdessen?',
  menuTextEnd: 'Zu welchem Zeitpunkt endet diese Veranstaltung stattdessen?',
  getCurrent: generalGet,
  setFunc: generalSet
}, {
  hide: hideGenerateChangeStep
})

addQuestionButton(menu, 'namesuffix', {
  emoji: '🗯',
  buttonText: 'Namenszusatz',
  uniqueIdentifier: 'change-add-suffix',
  questionText: 'Welche Zusatzinfo möchtest du dem Termin geben? Dies sollte nur ein Wort oder eine kurze Info sein, wie zum Beispiel "Klausurvorbereitung". Diese Info wird dann dem Titel des Termins angehängt.',
  getCurrent: generalGet,
  setFunc: generalSet
}, {
  hide: hideGenerateChangeStep
})

addQuestionButton(menu, 'room', {
  emoji: '📍',
  buttonText: 'Raum',
  uniqueIdentifier: 'change-add-room',
  questionText: 'In welchen Raum wurde der Termin verschoben?',
  getCurrent: generalGet,
  setFunc: generalSet
}, {
  hide: hideGenerateChangeStep
})

menu.simpleButton('✅ Fertig stellen', 'finish', {
  doFunc: finish,
  hide: ctx => !generationDataIsValid(ctx)
})

async function finish(ctx) {
  const change = ctx.session.generateChange

  if (!ctx.state.userconfig.changes) {
    ctx.state.userconfig.changes = []
  }

  const {name, date} = change
  if (ctx.state.userconfig.changes.some(o => o.name === name && o.date === date)) {
    // Dont do something when there is already a change for the date
    // This shouldn't occour but it can when the user adds a shared change
    // Also the user can add an additional date that he already has 'used'
    await ctx.answerCbQuery('Du hast bereits eine Veranstaltungsänderung für diesen Termin.')
    return
  }

  ctx.state.userconfig.changes.push(change)
  delete ctx.session.generateChange

  const actionPart = changeDetails.generateChangeAction(change)
  await changeDetails.setSpecific(ctx, `e:c:d-${actionPart}`)
}

menu.button('🛑 Neu beginnen', 'restart', {
  joinLastRow: true,
  doFunc: ctx => {
    ctx.session.generateChange = {}
  },
  hide: ctx => Object.keys(ctx.session.generateChange ?? {}).length === 0
})

module.exports = {
  menu
}
