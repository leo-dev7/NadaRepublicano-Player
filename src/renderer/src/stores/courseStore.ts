import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Course, Lesson, Module, CourseListEntry } from '@shared/types/course'

export type AppView = 'dashboard' | 'workspace'

export const useCourseStore = defineStore('course', () => {
  const courses = ref<Course[]>([])
  const recentCourses = ref<CourseListEntry[]>([])
  const activeCourse = ref<Course | null>(null)
  const activeLessonId = ref<string | null>(null)
  const activeNoteContent = ref('')
  const view = ref<AppView>('dashboard')
  const isLoading = ref(false)
  const searchQuery = ref('')
  const targetExpandKey = ref<string | null>(null)
  const noteSaveTimeout = ref<ReturnType<typeof setTimeout> | null>(null)

  function revealItem(target: string) {
    targetExpandKey.value = target
  }

  function findLessonRecursive(modules: Module[], lessonId: string): Lesson | null {
    for (const mod of modules) {
      const found = mod.lessons.find((l) => l.id === lessonId)
      if (found) return found
      if (mod.subModules && mod.subModules.length > 0) {
        const sub = findLessonRecursive(mod.subModules, lessonId)
        if (sub) return sub
      }
    }
    return null
  }

  function findModuleRecursive(modules: Module[], moduleId: string): Module | null {
    for (const mod of modules) {
      if (mod.id === moduleId) return mod
      if (mod.subModules && mod.subModules.length > 0) {
        const sub = findModuleRecursive(mod.subModules, moduleId)
        if (sub) return sub
      }
    }
    return null
  }

  function getAllLessonsRecursive(modules: Module[]): Lesson[] {
    const list: Lesson[] = []
    for (const mod of modules) {
      list.push(...mod.lessons)
      if (mod.subModules && mod.subModules.length > 0) {
        list.push(...getAllLessonsRecursive(mod.subModules))
      }
    }
    return list
  }

  function getFirstLessonRecursive(modules: Module[]): Lesson | null {
    for (const mod of modules) {
      if (mod.lessons && mod.lessons.length > 0) {
        return mod.lessons[0]
      }
      if (mod.subModules && mod.subModules.length > 0) {
        const found = getFirstLessonRecursive(mod.subModules)
        if (found) return found
      }
    }
    return null
  }

  const allLessons = computed((): Lesson[] => {
    if (!activeCourse.value) return []
    return getAllLessonsRecursive(activeCourse.value.modules)
  })

  const lessonsMap = computed((): Map<string, Lesson> => {
    const map = new Map<string, Lesson>()
    for (const l of allLessons.value) {
      map.set(l.id, l)
    }
    return map
  })

  const modulesMap = computed((): Map<string, Module> => {
    const map = new Map<string, Module>()
    function indexModules(mods: Module[]) {
      for (const m of mods) {
        map.set(m.id, m)
        if (m.subModules && m.subModules.length > 0) {
          indexModules(m.subModules)
        }
      }
    }
    if (activeCourse.value) {
      indexModules(activeCourse.value.modules)
    }
    return map
  })

  const activeLesson = computed((): Lesson | null => {
    if (!activeLessonId.value) return null
    return lessonsMap.value.get(activeLessonId.value) || null
  })

  const activeModule = computed((): Module | null => {
    if (!activeLesson.value) return null
    return modulesMap.value.get(activeLesson.value.moduleId) || null
  })

  const courseProgress = computed(() => {
    if (!activeCourse.value) return 0
    const total = activeCourse.value.totalLessonsCount
    if (total === 0) return 0
    return Math.round((activeCourse.value.completedLessonsCount / total) * 100)
  })

  const filteredCourses = computed(() => {
    if (!searchQuery.value) return courses.value
    const q = searchQuery.value.toLowerCase()
    return courses.value.filter(
      (c) => c.cleanTitle.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)
    )
  })

  async function loadRecentCourses() {
    try {
      recentCourses.value = await window.api.getRecentCourses()
    } catch (e) {
      console.error('Failed to load recent courses:', e)
    }
  }

  async function loadCourses() {
    isLoading.value = true
    try {
      await loadRecentCourses()
      courses.value = await window.api.getAllCourses()
    } catch (e) {
      console.error('Failed to load courses:', e)
    } finally {
      isLoading.value = false
    }
  }

  async function importCourse(folderPath: string) {
    isLoading.value = true
    try {
      const course = await window.api.importCourse(folderPath)
      courses.value = [course, ...courses.value.filter((c) => c.id !== course.id)]
      await loadRecentCourses()
      return course
    } finally {
      isLoading.value = false
    }
  }

  async function openCourse(courseId: string, autoPlayInMpc = false) {
    isLoading.value = true
    try {
      let course: Course | null = null
      try {
        course = await window.api.getCourse(courseId)
      } catch (err) {
        console.warn('Failed to load course via IPC, checking local cache:', err)
      }

      // If backend returned null, fallback to cached course in courses.value
      if (!course) {
        course = courses.value.find((c) => c.id === courseId) || null
      }

      if (course) {
        activeCourse.value = course
        view.value = 'workspace'
        await loadRecentCourses()

        // Prioritize lastLessonId if it exists in the course hierarchy,
        // otherwise find the first lesson across all modules & submodules
        let targetLessonId = course.lastLessonId
        if (!targetLessonId || !findLessonRecursive(course.modules, targetLessonId)) {
          const firstLesson = getFirstLessonRecursive(course.modules)
          targetLessonId = firstLesson?.id
        }

        if (targetLessonId) {
          await selectLesson(targetLessonId, autoPlayInMpc)
        }
      }
    } finally {
      isLoading.value = false
    }
  }

  async function selectLesson(lessonId: string, autoPlayInMpc = false) {
    activeLessonId.value = lessonId
    if (activeCourse.value) {
      await loadNote()
    }
    if (autoPlayInMpc) {
      await playInMpc(lessonId)
    }
  }

  async function playLesson(lessonId: string) {
    await selectLesson(lessonId, true)
  }

  async function playInMpc(lessonId?: string) {
    if (lessonId && lessonId !== activeLessonId.value) {
      await selectLesson(lessonId, false)
    }
    const lesson = activeLesson.value
    if (!lesson || !activeCourse.value) return
    await window.api.mpcOpenFile({
      filePath: lesson.absolutePath,
      startMs: lesson.lastPositionMs || 0,
      lessonId: lesson.id
    })
  }

  async function playNextLesson() {
    const lessons = allLessons.value
    if (!activeLessonId.value) return
    const currentIndex = lessons.findIndex((l) => l.id === activeLessonId.value)
    if (currentIndex === -1 || currentIndex >= lessons.length - 1) return
    const nextLesson = lessons[currentIndex + 1]
    if (nextLesson) {
      await markLessonComplete(activeLessonId.value, true)
      await selectLesson(nextLesson.id, true)
    }
  }

  async function markLessonComplete(lessonId: string, completed: boolean) {
    if (!activeCourse.value) return
    await window.api.toggleLessonComplete({
      courseId: activeCourse.value.id,
      lessonId,
      completed
    })

    function updateComplete(modules: Module[]): boolean {
      for (const mod of modules) {
        const lesson = mod.lessons.find((l) => l.id === lessonId)
        if (lesson) {
          lesson.isCompleted = completed
          lesson.completedAt = completed ? new Date().toISOString() : undefined
          mod.completedLessonsCount = mod.lessons.filter((l) => l.isCompleted).length
          return true
        }
        if (mod.subModules && updateComplete(mod.subModules)) {
          mod.completedLessonsCount =
            mod.lessons.filter((l) => l.isCompleted).length +
            mod.subModules.reduce((sum, sm) => sum + sm.completedLessonsCount, 0)
          return true
        }
      }
      return false
    }

    updateComplete(activeCourse.value.modules)
    activeCourse.value.completedLessonsCount = allLessons.value.filter((l) => l.isCompleted).length
  }

  async function updateLessonProgress(lessonId: string, positionMs: number, durationMs: number) {
    if (!activeCourse.value) return
    await window.api.setLessonProgress({
      courseId: activeCourse.value.id,
      lessonId,
      positionMs,
      durationMs
    })

    function updatePos(modules: Module[]): boolean {
      for (const mod of modules) {
        const lesson = mod.lessons.find((l) => l.id === lessonId)
        if (lesson) {
          lesson.lastPositionMs = positionMs
          lesson.durationMs = durationMs
          return true
        }
        if (mod.subModules && updatePos(mod.subModules)) {
          return true
        }
      }
      return false
    }

    updatePos(activeCourse.value.modules)
    activeCourse.value.lastLessonId = lessonId
    activeCourse.value.lastPositionMs = positionMs
  }

  async function loadNote() {
    if (!activeCourse.value || !activeLessonId.value) return
    try {
      const note = await window.api.getNote({
        courseId: activeCourse.value.id,
        lessonId: activeLessonId.value
      })
      activeNoteContent.value = note?.markdownContent || ''
    } catch {
      activeNoteContent.value = ''
    }
  }

  async function saveNote(content: string) {
    activeNoteContent.value = content
    if (!activeCourse.value || !activeLessonId.value) return

    if (noteSaveTimeout.value) clearTimeout(noteSaveTimeout.value)
    noteSaveTimeout.value = setTimeout(async () => {
      if (!activeCourse.value || !activeLessonId.value) return
      await window.api.saveNote({
        courseId: activeCourse.value.id,
        lessonId: activeLessonId.value,
        content
      })
    }, 800)
  }

  async function deleteCourse(courseId: string) {
    await window.api.deleteCourse(courseId)
    courses.value = courses.value.filter((c) => c.id !== courseId)
    if (activeCourse.value?.id === courseId) {
      goToDashboard()
    }
  }

  function goToDashboard() {
    activeCourse.value = null
    activeLessonId.value = null
    activeNoteContent.value = ''
    view.value = 'dashboard'
  }

  async function refreshActiveCourse() {
    if (!activeCourse.value) return
    const course = await window.api.rescanCourse(activeCourse.value.id)
    if (course) {
      activeCourse.value = course
    }
  }

  return {
    courses,
    recentCourses,
    activeCourse,
    activeLessonId,
    activeLesson,
    activeModule,
    allLessons,
    activeNoteContent,
    view,
    isLoading,
    searchQuery,
    targetExpandKey,
    revealItem,
    courseProgress,
    filteredCourses,
    loadRecentCourses,
    loadCourses,
    importCourse,
    openCourse,
    selectLesson,
    playLesson,
    playInMpc,
    playNextLesson,
    markLessonComplete,
    updateLessonProgress,
    loadNote,
    saveNote,
    deleteCourse,
    goToDashboard,
    refreshActiveCourse
  }
})

