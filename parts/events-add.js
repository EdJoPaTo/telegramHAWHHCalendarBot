const TelegrafInlineMenu = require('telegraf-inline-menu')

const allEvents = require('../lib/all-events')

const MAX_RESULT_ROWS = 10
const RESULT_COLUMNS = 3

const menu = new TelegrafInlineMenu('e:a', 'Welche Events möchtest du hinzufügen?')
function filterText(ctx) {
  let text = '🔎 Filter'
  if (ctx.session.eventfilter && ctx.session.eventfilter !== '.+') {
    text += ': ' + ctx.session.eventfilter
  }
  return text
}
menu.question('filter', filterText,
  (ctx, answer) => {
    ctx.session.eventfilter = answer
  }, {
    questionText: 'Wonach möchtest du filtern?'
  }
)

menu.button('clearfilter', 'Filter aufheben', ctx => {
  ctx.session.eventfilter = '.+'
}, {
  joinLastRow: true,
  hide: ctx => !ctx.session.eventfilter || ctx.session.eventfilter === '.+'
})

function findEvents(ctx) {
  const pattern = ctx.session.eventfilter || '.+'
  const blacklist = ctx.state.userconfig.events
    .concat(ctx.state.userconfig.additionalEvents || [])

  const results = allEvents.find(pattern, blacklist)

  return results.splice(0, RESULT_COLUMNS * MAX_RESULT_ROWS)
}

menu.list('add',
  findEvents,
  addEvent, {
    columns: RESULT_COLUMNS
  }
)

function addEvent(ctx, event) {
  const isExisting = allEvents.exists(event)
  const isAlreadyInCalendar = ctx.state.userconfig.events
    .concat(ctx.state.userconfig.additionalEvents || [])
    .indexOf(event) >= 0

  if (isExisting && !isAlreadyInCalendar) {
    ctx.state.userconfig.events.push(event)
    ctx.state.userconfig.events.sort()
  }

  if (!isExisting) {
    return ctx.answerCbQuery(`${event} existiert nicht!`)
  }

  if (isAlreadyInCalendar) {
    return ctx.answerCbQuery(`${event} ist bereits in deinem Kalender!`)
  }

  return ctx.answerCbQuery(`${event} wurde zu deinem Kalender hinzugefügt.`)
}

module.exports = {
  menu
}
