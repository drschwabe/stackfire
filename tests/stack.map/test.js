const _ = require('underscore')

module.exports = (test, stack) => {
  test('stack.map can map an array', t => {
    t.plan(3)

    let good = ['happy', 'excited', 'fun']

    stack.on(`great/:emotion`, () => {
      log('great? ' + stack.params().emotion)
      let emotion = stack.body()
      return emotion + '!'
    })

    //sync version; WIP: 
    // let great = stack.map(good, emotion => 
    //   `great/${emotion}`
    // )

    let great
    stack.map(good, emotion => `great/${emotion}`, 
      (err, results) => {
        great = results
        log(great)
        t.ok( great[0].search('!') > -1 , 'great!')
        t.ok( great[1].search('!') > -1, 'great!')
        t.ok( great[2].search('!') > -1, 'great!')
      } 
    )

  })
}