// #### STACKFIRE4 ####

const async = require('async')
const gg = require('gamegrids')

const stack = {
  listeners : [],
  commands : [],
  grid : gg.populateCells(gg.createGrid(1,1)),
}

require('./mods/on.js')

//require('./mods/fire.js')

module.exports = stack