import React from 'react'
import ReactDOM from 'react-dom/client'
import { UI_CSS } from '../../src/client/styles'
import { createDockStats } from '../../src/client/dock-stats'
import { createPluginSettings } from '../../src/client/plugin-settings'

window.testFixture = {
  React,
  ReactDOM,
  UI_CSS,
  createDockStats,
  createPluginSettings
}
