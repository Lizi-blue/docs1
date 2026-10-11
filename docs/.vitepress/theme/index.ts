import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import Layout from './Layout.vue'
import ProgressBar from './components/ProgressBar.vue'
import Prerequisite from './components/Prerequisite.vue'
import ApiTable from './components/ApiTable.vue'
import InstallBox from './components/InstallBox.vue'
import CodeTabs from './components/CodeTabs.vue'
import DiagramFrame from './components/DiagramFrame.vue'
import EntryIndex from './components/EntryIndex.vue'
import TagIndex from './components/TagIndex.vue'
import RelatedLinks from './components/RelatedLinks.vue'
import './styles/custom.css'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('ProgressBar', ProgressBar)
    app.component('Prerequisite', Prerequisite)
    app.component('ApiTable', ApiTable)
    app.component('InstallBox', InstallBox)
    app.component('CodeTabs', CodeTabs)
    app.component('DiagramFrame', DiagramFrame)
    app.component('EntryIndex', EntryIndex)
    app.component('TagIndex', TagIndex)
    app.component('RelatedLinks', RelatedLinks)
  },
} satisfies Theme
