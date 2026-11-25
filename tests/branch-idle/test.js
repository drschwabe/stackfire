const test = require('tape')
const importFresh = require('import-fresh')

for (const frozen of [false, true]) {
  for (const method of ['branch', 'auto']) {
    test(`${method} starts independent commands when idle (frozen=${frozen})`, async t => {
      t.timeoutAfter(3000)
      const stack = importFresh('../../stack.js')
      const started = []
      const branchEvents = []
      stack.utils.push((event, detail) => {
        if (event === 'fire_started') started.push(detail)
        if (event === 'fire_branch') branchEvents.push(detail)
      })
      stack.on(['first', 'second'], body => body)
      if (frozen) stack.freeze()

      const first = { value: 1 }
      const second = { value: 2 }
      t.equal(await stack[method]('first', first), first, 'first idle call returns its body')
      t.equal(await stack[method]('second', second), second, 'later idle call returns its body')
      t.equal(stack.path, '/second', 'latest command remains available for inspection')
      t.equal(stack.body, second, 'latest body remains available for inspection')
      t.equal(started.length, 2, 'both commands dispatched')
      t.ok(started.every(command => !command.branch && !command.parentPath), 'no stale parent')
      t.equal(branchEvents.length, 0, 'idle dispatch emits no branch event')
      t.end()
    })

    test(`${method} branches and drains queued fires in order (frozen=${frozen})`, async t => {
      t.timeoutAfter(3000)
      const stack = importFresh('../../stack.js')
      const order = []
      const queued = []
      const parentBody = { parent: true }
      const childBody = { child: true }
      let resumedPath, resumedBody, resumedParams
      stack.on('parent/:id', async () => {
        order.push('parent:start')
        queued.push(stack.fire('queued/one'))
        t.equal(await stack[method]('child/child-id', childBody), childBody, 'child result returned')
        resumedPath = stack.path
        resumedBody = stack.body
        resumedParams = stack.params
        order.push('parent:resume')
      })
      // Different parameter names ensure listener-specific parent params are restored.
      stack.on('parent/:other', () => { order.push('parent:last') })
      stack.on('child/:id', async () => {
        order.push('child')
        queued.push(stack.fire('queued/two'))
        await stack[method]('grandchild')
        t.equal(stack.path, '/child/child-id', 'nested branch restores child context')
      })
      stack.on('grandchild', () => { order.push('grandchild') })
      stack.on('queued/:id', () => { order.push(`queued:${stack.params.id}`) })
      if (frozen) stack.freeze()

      t.equal(await stack[method]('parent/parent-id', parentBody), parentBody, 'root result retained while queue drains')
      await Promise.all(queued)
      t.deepEqual(order, ['parent:start', 'child', 'grandchild', 'parent:resume', 'parent:last', 'queued:one', 'queued:two'],
        'children finish before parent resumes; queued fires retain FIFO order')
      t.equal(resumedPath, '/parent/parent-id', 'parent path restored')
      t.equal(resumedBody, parentBody, 'parent body restored')
      t.deepEqual(resumedParams, { id: 'parent-id' }, 'parent listener params restored')
      t.equal(stack.fireQ.length, 0, 'queue drained')
      t.end()
    })
  }

  test(`immediate fire after an idle branch waits for it (frozen=${frozen})`, async t => {
    t.timeoutAfter(3000)
    const stack = importFresh('../../stack.js')
    const order = []
    stack.on('first', async () => {
      order.push('first:start')
      await new Promise(resolve => setTimeout(resolve, 10))
      order.push('first:end')
    })
    stack.on('second', () => { order.push('second') })
    if (frozen) stack.freeze()
    await Promise.all([stack.branch('first'), stack.fire('second')])
    t.deepEqual(order, ['first:start', 'first:end', 'second'], 'root branch participates in queue tracking immediately')
    t.end()
  })

  test(`dispatch is active during lifecycle hooks (frozen=${frozen})`, async t => {
    t.timeoutAfter(3000)
    const stack = importFresh('../../stack.js')
    const order = []
    let queued
    stack.utils.push(async (event, detail) => {
      if (event === 'fire_started' && detail.path === '/parent') {
        queued = stack.fire('queued')
        await stack.branch('child')
        t.equal(stack.path, '/parent', 'branch restores command inside start hook')
      }
      if (event === 'fire_complete') order.push(`complete:${detail.path}`)
    })
    for (const path of ['parent', 'child', 'queued']) {
      stack.on(path, () => { order.push(path) })
    }
    if (frozen) stack.freeze()
    await stack.branch('parent')
    await queued
    t.deepEqual(order, ['child', 'complete:/child', 'parent', 'complete:/parent', 'queued', 'complete:/queued'],
      'hook can await a child while other fires wait for the parent')
    t.end()
  })
}
