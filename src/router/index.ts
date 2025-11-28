import { createRouter, createWebHistory } from 'vue-router'
import GenerationView from '../views/GenerationView.vue'
import UploadView from '../views/UploadView.vue'
import AnalysisView from '../views/AnalysisView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/generate',
    },
    {
      path: '/generate',
      name: 'generate',
      component: GenerationView,
    },
    {
      path: '/upload',
      name: 'upload',
      component: UploadView,
    },
    {
      path: '/analysis',
      name: 'analysis',
      component: AnalysisView,
    },
  ],
})

export default router
