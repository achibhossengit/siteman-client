import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createSite } from '../../api/sites.js'
import { siteFormSchema, toSitePayload } from '../../api/types/site.js'
import { parseApiError, applyFieldErrors } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { useAuth } from '../../providers/AuthProvider.jsx'
import { paths } from '../../router/paths.js'

const emptyValues = {
  name: '',
  is_active: true,
}

export const SiteNewPage = () => {
  const navigate = useNavigate()
  const { setTitle } = useOutletContext()
  const queryClient = useQueryClient()
  const { bootstrapProfile } = useAuth()
  const [apiError, setApiError] = useState(null)

  useEffect(() => {
    setTitle?.('নতুন সাইট')
    return () => setTitle?.('')
  }, [setTitle])

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(siteFormSchema),
    defaultValues: emptyValues,
  })

  const mutation = useMutation({
    mutationFn: (values) => createSite(toSitePayload(values)),
  })

  const saveSite = async (values, { createAnother }) => {
    setApiError(null)
    try {
      await mutation.mutateAsync(values)
      await queryClient.invalidateQueries({ queryKey: ['sites'] })
      try {
        await bootstrapProfile()
      } catch {
        // list still refreshed; selector may lag until next profile fetch
      }
      if (createAnother) {
        reset(emptyValues)
      } else {
        navigate(paths.sites, { replace: true })
      }
    } catch (err) {
      const parsed = parseApiError(err)
      setApiError(parsed)
      applyFieldErrors(parsed, setError)
    }
  }

  const onSubmit = handleSubmit((values) =>
    saveSite(values, { createAnother: false }),
  )

  const onSaveAndCreateAnother = handleSubmit((values) =>
    saveSite(values, { createAnother: true }),
  )

  return (
    <div className="max-w-lg mx-auto">
      <ApiErrorAlert error={apiError} className="mb-3" />

      <form className="flex flex-col gap-3" onSubmit={onSubmit} noValidate>
        <label className="form-control w-full">
          <span className="label-text mb-1">সাইটের নাম</span>
          <input
            type="text"
            className={`input input-bordered w-full ${errors.name ? 'input-error' : ''}`}
            maxLength={255}
            autoFocus
            {...register('name')}
          />
          {errors.name ? (
            <span className="label-text-alt text-error mt-1">
              {errors.name.message}
            </span>
          ) : null}
        </label>

        <label className="label cursor-pointer justify-start gap-3 py-2">
          <input
            type="checkbox"
            className="toggle toggle-primary"
            {...register('is_active')}
          />
          <span className="label-text">সক্রিয়</span>
        </label>

        <div className="flex justify-between gap-2 mt-2">
          <button
            type="button"
            className="btn btn-outline btn-primary flex-1"
            disabled={isSubmitting || mutation.isPending}
            onClick={onSaveAndCreateAnother}
          >
            আরেকটি
          </button>
          <button
            type="submit"
            className="btn btn-primary flex-1"
            disabled={isSubmitting || mutation.isPending}
          >
            {isSubmitting || mutation.isPending ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              'সংরক্ষণ'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
