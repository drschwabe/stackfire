const { log } = console
const test = require('tape')
const importFresh = require('import-fresh')

test('cacheable handler returns cached result on second fire', async t => {
  const stack = importFresh('../../stack.js')
  let callCount = 0

  stack.on('bake/menu', e => {
    callCount++
    return { html: `<div>rendered ${callCount}</div>` }
  }, { cacheable: true })

  const first = await stack.fire('bake/menu', { html: '' })
  t.equal(first.html, '<div>rendered 1</div>', 'first call runs handler')
  t.equal(callCount, 1)

  const second = await stack.fire('bake/menu', { html: '' })
  t.equal(second.html, '<div>rendered 1</div>', 'second call returns cached')
  t.equal(callCount, 1, 'handler not called again')

  t.end()
})

test('stack.refresh invalidates cache (lazy)', async t => {
  const stack = importFresh('../../stack.js')
  let callCount = 0

  stack.on('bake/header', e => {
    callCount++
    return { html: `header-${callCount}` }
  }, { cacheable: true })

  await stack.fire('bake/header', { html: '' })
  t.equal(callCount, 1)

  await stack.fire('bake/header', { html: '' })
  t.equal(callCount, 1, 'still cached')

  stack.refresh('bake/header')

  const result = await stack.fire('bake/header', { html: '' })
  t.equal(callCount, 2, 'handler re-ran after refresh')
  t.equal(result.html, 'header-2', 'fresh result returned')

  t.end()
})

test('stack.refreshNow invalidates and immediately re-runs', async t => {
  const stack = importFresh('../../stack.js')
  let callCount = 0

  stack.on('bake/tree', e => {
    callCount++
    return { html: `tree-${callCount}` }
  }, { cacheable: true })

  await stack.fire('bake/tree', { html: '' })
  t.equal(callCount, 1)

  const fresh = await stack.refreshNow('bake/tree', { html: '' })
  t.equal(callCount, 2, 'handler ran immediately')
  t.equal(fresh.html, 'tree-2', 'fresh result returned')

  const cached = await stack.fire('bake/tree', { html: '' })
  t.equal(callCount, 2, 'subsequent fire uses new cache')
  t.equal(cached.html, 'tree-2')

  t.end()
})

test('refresh accepts multiple paths', async t => {
  const stack = importFresh('../../stack.js')
  let menuCount = 0, headerCount = 0

  stack.on('bake/menu', () => { menuCount++; return { n: menuCount } }, { cacheable: true })
  stack.on('bake/header', () => { headerCount++; return { n: headerCount } }, { cacheable: true })

  await stack.fire('bake/menu')
  await stack.fire('bake/header')
  t.equal(menuCount, 1)
  t.equal(headerCount, 1)

  stack.refresh('bake/menu', 'bake/header')

  await stack.fire('bake/menu')
  await stack.fire('bake/header')
  t.equal(menuCount, 2, 'menu refreshed')
  t.equal(headerCount, 2, 'header refreshed')

  t.end()
})

test('non-cacheable handlers always run', async t => {
  const stack = importFresh('../../stack.js')
  let callCount = 0

  stack.on('render/feed', () => {
    callCount++
    return { html: `feed-${callCount}` }
  })

  await stack.fire('render/feed')
  await stack.fire('render/feed')
  await stack.fire('render/feed')
  t.equal(callCount, 3, 'handler runs every time without cacheable')

  t.end()
})

test('cache works with branch inside a handler', async t => {
  const stack = importFresh('../../stack.js')
  let menuCount = 0

  stack.on('bake/menu', () => {
    menuCount++
    return { html: `menu-${menuCount}` }
  }, { cacheable: true })

  stack.on('render/page', async () => {
    const menu = await stack.branch('bake/menu', { html: '' })
    return { page: menu.html }
  })

  const first = await stack.fire('render/page')
  t.equal(first.page, 'menu-1')
  t.equal(menuCount, 1)

  const second = await stack.fire('render/page')
  t.equal(second.page, 'menu-1', 'branch returned cached menu')
  t.equal(menuCount, 1, 'menu handler not re-called')

  t.end()
})

test('parameterized routes cache separately per concrete path', async t => {
  const stack = importFresh('../../stack.js')
  let callCount = 0

  stack.on('bake/file/:type', e => {
    callCount++
    return { html: `${stack.params.type}-${callCount}` }
  }, { cacheable: true })

  const md = await stack.fire('bake/file/markdown')
  t.equal(md.html, 'markdown-1')

  const img = await stack.fire('bake/file/image')
  t.equal(img.html, 'image-2', 'different path = different cache entry')

  const md2 = await stack.fire('bake/file/markdown')
  t.equal(md2.html, 'markdown-1', 'markdown path still cached')
  t.equal(callCount, 2, 'only two handler calls total')

  t.end()
})

test('flush clears cache along with listeners', async t => {
  const stack = importFresh('../../stack.js')
  let callCount = 0

  stack.on('bake/x', () => { callCount++; return { n: callCount } }, { cacheable: true })

  await stack.fire('bake/x')
  t.equal(callCount, 1)
  t.equal(stack.cache.size, 1, 'cache has entry')

  stack.flush()
  t.equal(stack.cache.size, 0, 'cache cleared after flush')

  t.end()
})
