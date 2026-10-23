import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Course, Lesson, Module } from '@shared/types/course'

export type AppView = 'dashboard' | 'workspace'

export const useCourseStore = defineStore('course', () => {
  const courses = ref<Course[]>([])
  const activeCourse = ref<Course | null>(null)
  const activeLessonId = ref<string | null>(null)
  const activeNoteContent = ref('')
  const view = ref<AppView>('dashboard')
  const isLoading = ref(false)
  const searchQuery = ref('')
  const noteSaveTimeout = ref<ReturnType<typeof setTimeout> | null>(null)

  const activeLesson = computed((): Lesson | null => {
    if (!activeCourse.value || !activeLessonId.value) return null
    for (const mod of activeCourse.value.modules) {
      const lesson = mod.lessons.find((l) => l.id === activeLessonId.value)
      if (lesson) return lesson
    }
    return null
  })

  const activeModule = computed((): Module | null => {
    if (!activeLesson.value || !activeCourse.value) return null
    return activeCourse.value.modules.find((m) => m.id === activeLesson.value!.moduleId) ?? null
  })

  const allLessons = computed((): Lesson[] => {
    if (!activeCourse.value) return []
    return activeCourse.value.modules.flatMap((m) => m.lessons)
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

  async function loadCourses() {
    isLoading.value = true
    try {
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
      return course
    } finally {
      isLoading.value = false
    }
  }

  async function openCourse(courseId: string) {
    isLoading.value = true
    try {
      const course = await window.api.getCourse(courseId)
      if (course) {
        activeCourse.value = course
        view.value = 'workspace'
        const targetLessonId = course.lastLessonId || course.modules[0]?.lessons[0]?.id
        if (targetLessonId) {
          await selectLesson(targetLessonId)
        }
      }
    } finally {
      isLoading.value = false
    }
  }

  async function selectLesson(lessonId: string) {
    activeLessonId.value = lessonId
    if (activeCourse.value) {
      await loadNote()
    }
  }

  async function playLesson(lessonId: string) {
    await selectLesson(lessonId)
  }

  async function playInMpc(lessonId?: string) {
    if (lessonId) await selectLesson(lessonId)
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
      await selectLesson(nextLesson.id)
    }
  }

  async function markLessonComplete(lessonId: string, completed: boolean) {
    if (!activeCourse.value) return
    await window.api.toggleLessonComplete({
      courseId: activeCourse.value.id,
      lessonId,
      completed
    })

    for (const mod of activeCourse.value.modules) {
      const lesson = mod.lessons.find((l) => l.id === lessonId)
      if (lesson) {
        lesson.isCompleted = completed
        lesson.completedAt = completed ? new Date().toISOString() : undefined
        mod.completedLessonsCount = mod.lessons.filter((l) => l.isCompleted).length
        break
      }
    }
    activeCourse.value.completedLessonsCount = activeCourse.value.modules.reduce(
      (sum, m) => sum + m.completedLessonsCount,
      0
    )
  }

  async function updateLessonProgress(lessonId: string, positionMs: number, durationMs: number) {
    if (!activeCourse.value) return
    await window.api.setLessonProgress({
      courseId: activeCourse.value.id,
      lessonId,
      positionMs,
      durationMs
    })

    for (const mod of activeCourse.value.modules) {
      const lesson = mod.lessons.find((l) => l.id === lessonId)
      if (lesson) {
        lesson.lastPositionMs = positionMs
        lesson.durationMs = durationMs
        break
      }
    }
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
    activeCourse,
    activeLessonId,
    activeLesson,
    activeModule,
    allLessons,
    activeNoteContent,
    view,
    isLoading,
    searchQuery,
    courseProgress,
    filteredCourses,
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

