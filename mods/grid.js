const gg = require('gamegrids')

module.exports = (stack) => {
  stack.grid = gg.populateCells(gg.createGrid(1,1))
}

