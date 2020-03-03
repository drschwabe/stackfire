module.exports = (test, stack) => {
  test('next.fire ends command', (t) => {
    //next.fire clears queue so next command can run...
    t.plan(2)

    stack.on('create-doc/save', () => {
      console.log('create-doc/save ran')
      t.pass()
    })

    stack.on('create-doc/save', next => {
      next.fire('docs-feed/save', () => {
        console.log('docs-feed/save final listener ran')
      })
    })

    stack.on('docs-feed/save', () => {
      console.log('docs-feed/save ran')
    })

    stack.fire('keyup/Escape', next => {
      next.fire('create-doc/save', () => {
        //debugger
        console.log('create-doc/save final listener ran, which is also final listener apart of keyup/Escape')
      })
    })

    stack.fire('some-other-command-to-run-after', () => {
      t.pass('other command ran; queue is clear')
    })

    //debugger

  })
}