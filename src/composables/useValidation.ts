import { computed } from 'vue'
import { useProblemStore } from '../stores/problemStore'
import { validateProblem } from '../services/validators'

/** Returns a Set of field names that have errors, and the full error list. */
export function useValidation() {
  const problemStore = useProblemStore()
  const errors = computed(() => validateProblem(problemStore.draft))
  const errorFields = computed(() => new Set(errors.value.map(e => e.field)))

  function hasError(field: string) {
    return errorFields.value.has(field)
  }

  function errorFor(field: string): string | null {
    return errors.value.find(e => e.field === field)?.message ?? null
  }

  return { errors, hasError, errorFor }
}
