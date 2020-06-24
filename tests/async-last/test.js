
module.exports = (test, stack) => {
  test('stack.first() happens, then stack.second() and so forth', (t) => {
    t.plan(4)

    let count = 0

    stack.last('state-save', next => {
      console.log('state-save last listener...')
      setTimeout( () => {
        console.log('done!')
        count++
        t.equals(count, 3)
        next()
      }, 1000)
    })

    stack.on('state-save', () => {
      console.log('state-save first .on listener')
      count++
      t.equals(count, 1)
    })

    stack.on('state-save', () => {
      console.log('state-save second .on listener')
      count++
      t.equals(count, 2)
    })

    stack.on('start-buffet/save', next => {
      next.fire('new-favv-and-topic', next => {
        next.fire('list-menu-toggle/off', next => {
          next.fire('start/close', () => {
            t.pass('closed')
          })
        })
      })
    })

    stack.on('new-favv-and-topic', next => {
      next.fire('save-all-lists-to-db', next => {
        setTimeout(() => {
          next()
        }, 500)
      })
    })

    stack.on('new-favv-and-topic', () => console.log('new favv and topic'))
    stack.on('list-menu-toggle/off', () => console.log('list-menu-toggle/off'))

    stack.on('start/close', next => {
      next.fire('state-save')
    })

    stack.fire('start-buffet/save', () => {
      console.log('saved')
    })

  })
}
