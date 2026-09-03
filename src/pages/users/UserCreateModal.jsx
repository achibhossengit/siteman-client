import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { createUser } from '../../api/users.js'
import {
  buildGroupSelectOptions,
  passwordCreateSchema,
  applyUserAdminFieldErrors,
  toUserCreatePayload,
  userCreateSchema,
} from '../../api/types/user.js'
import { parseApiError } from '../../api/errors.js'
import { ApiErrorAlert } from '../../components/ApiErrorAlert.jsx'
import { useSitesLookup } from '../../hooks/useSites.js'
import { useAuth } from '../../providers/AuthProvider.jsx'
import { toastSuccess } from '../../utils/feedback.js'
import { BD_PHONE_MESSAGE, isBdPhoneNumber } from '../../utils/phone.js'
import { companyGroups } from '../../api/types/company.js'

const emptyValues = {
  name: '',
  phone_number: '',
  password: '',
  groups: [],
  sites: [],
}

const toggleItem = (list, item) =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item]

/** Only show hints while invalid — valid fields stay quiet like নাম. */
const phoneLiveHint = (raw) => {
  const value = String(raw ?? '').trim()
  if (!value) return null
  if (!/^\d*$/.test(value)) return 'শুধু সংখ্যা দিন'
  if (value.length < 11) return `১১ ডিজিট দিন (${value.length}/১১)`
  if (!isBdPhoneNumber(value)) return BD_PHONE_MESSAGE
  return null
}

const passwordLiveHint = (raw) => {
  const value = String(raw ?? '')
  if (!value) return null
  const parsed = passwordCreateSchema.safeParse(value)
  if (parsed.success) return null
  return parsed.error.issues?.[0]?.message || 'সঠিক পাসওয়ার্ড দিন'
}

export const UserCreateModal = forwardRef(function UserCreateModal(_, ref) {
  const queryClient = useQueryClient()
  const dialogRef = useRef(null)
  const { company } = useAuth()
  const [apiError, setApiError] = useState(null)
  const [showPassword, setShowPassword] = useState(false)

  const {
    sites: allSites,
    isLoading: sitesLoading,
  } = useSitesLookup()

  const assignableGroups = buildGroupSelectOptions(companyGroups(company))

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(userCreateSchema),
    defaultValues: emptyValues,
  })

  const watched = watch()
  const groupNames = watched.groups ?? []
  const siteIds = watched.sites ?? []
  const phoneHint = useMemo(
    () => phoneLiveHint(watched.phone_number),
    [watched.phone_number],
  )
  const passwordHint = useMemo(
    () => passwordLiveHint(watched.password),
    [watched.password],
  )
  const formReady = useMemo(
    () => userCreateSchema.safeParse(watched).success,
    [watched],
  )

  const mutation = useMutation({
    mutationFn: (values) => createUser(toUserCreatePayload(values)),
  })

  const busy = isSubmitting || mutation.isPending
  const saveDisabled = busy || !formReady || sitesLoading

  const resetModal = () => {
    setApiError(null)
    setShowPassword(false)
    reset(emptyValues)
  }

  const closeModal = () => {
    dialogRef.current?.close()
  }

  useImperativeHandle(ref, () => ({
    open: () => {
      resetModal()
      dialogRef.current?.showModal()
    },
  }))

  const saveUser = async (values, { createAnother }) => {
    setApiError(null)
    try {
      await mutation.mutateAsync(values)
      await queryClient.invalidateQueries({ queryKey: ['users', 'list'] })
      toastSuccess('ইউজার তৈরি হয়েছে')
      if (createAnother) {
        reset(emptyValues)
        setShowPassword(false)
      } else {
        closeModal()
      }
    } catch (err) {
      const parsed = parseApiError(err)
      setApiError(parsed)
      applyUserAdminFieldErrors(parsed, setError)
    }
  }

  const onSubmit = handleSubmit((values) =>
    saveUser(values, { createAnother: false }),
  )

  const onSaveAndCreateAnother = handleSubmit((values) =>
    saveUser(values, { createAnother: true }),
  )

  return (
    <dialog ref={dialogRef} className="modal" onClose={resetModal}>
      <div className="modal-box w-11/12 max-w-sm max-h-[min(34rem,88dvh)] p-4 flex flex-col overflow-hidden">
        <form method="dialog">
          <button
            type="submit"
            className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
            aria-label="বন্ধ"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </form>

        <h3 className="font-semibold text-base pr-8 shrink-0">নতুন ইউজার</h3>

        <ApiErrorAlert error={apiError} />

        <form
          className="flex flex-col flex-1 min-h-0 mt-2"
          onSubmit={onSubmit}
          noValidate
        >
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col gap-2 pr-0.5">
            <label className="form-control w-full">
              <span className="label-text text-sm mb-0.5">নাম</span>
              <input
                type="text"
                className={`input input-bordered input-sm w-full ${errors.name ? 'input-error' : ''}`}
                maxLength={255}
                placeholder="ইউজারের নাম"
                {...register('name')}
              />
              {errors.name ? (
                <span className="label-text-alt text-error mt-0.5">
                  {errors.name.message}
                </span>
              ) : null}
            </label>

            <label className="form-control w-full">
              <span className="label-text text-sm mb-0.5">ফোন নম্বর</span>
              <input
                type="tel"
                inputMode="numeric"
                className={`input input-bordered input-sm w-full ${
                  errors.phone_number || phoneHint ? 'input-error' : ''
                }`}
                maxLength={11}
                placeholder="০১XXXXXXXXX"
                {...register('phone_number')}
              />
              {phoneHint ? (
                <span className="label-text-alt text-error mt-0.5">
                  {phoneHint}
                </span>
              ) : errors.phone_number ? (
                <span className="label-text-alt text-error mt-0.5">
                  {errors.phone_number.message}
                </span>
              ) : null}
            </label>

            <div className="form-control w-full">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="label-text text-sm">পাসওয়ার্ড</span>
                <button
                  type="button"
                  className="link link-hover text-xs text-base-content/70"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? 'লুকান' : 'দেখুন'}
                </button>
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                maxLength={20}
                className={`input input-bordered input-sm w-full ${
                  errors.password || passwordHint ? 'input-error' : ''
                }`}
                placeholder="কমপক্ষে ৮ অক্ষর"
                {...register('password')}
              />
              {passwordHint ? (
                <span className="label-text-alt text-error mt-0.5">
                  {passwordHint}
                </span>
              ) : errors.password ? (
                <span className="label-text-alt text-error mt-0.5">
                  {errors.password.message}
                </span>
              ) : null}
            </div>

            <div>
              <span className="label-text text-sm mb-1 block">গ্রুপ</span>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {assignableGroups.length === 0 ? (
                  <p className="text-xs text-base-content/55 py-1">
                    কোনো গ্রুপ নেই।
                  </p>
                ) : (
                  assignableGroups.map((g) => {
                    const checked = groupNames.includes(g.name)
                    return (
                      <label
                        key={g.name}
                        className="inline-flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="checkbox checkbox-xs checkbox-primary"
                          checked={checked}
                          onChange={() =>
                            setValue('groups', toggleItem(groupNames, g.name))
                          }
                        />
                        <span className="text-sm">{g.label}</span>
                      </label>
                    )
                  })
                )}
              </div>
              {errors.groups ? (
                <span className="label-text-alt text-error mt-0.5">
                  {errors.groups.message}
                </span>
              ) : null}
            </div>

            <div>
              <span className="label-text text-sm mb-1 block">
                দায়িত্বপ্রাপ্ত সাইট
              </span>
              <div className="border border-base-300 rounded-box p-1.5 max-h-24 overflow-y-auto overscroll-contain">
                {sitesLoading ? (
                  <div className="flex justify-center py-2">
                    <span className="loading loading-spinner loading-sm" />
                  </div>
                ) : allSites.length === 0 ? (
                  <p className="text-xs text-base-content/55 py-1">
                    কোনো সাইট নেই।
                  </p>
                ) : (
                  allSites.map((s) => {
                    const id = Number(s.id)
                    const checked = siteIds.includes(id)
                    return (
                      <label
                        key={id}
                        className="flex items-center gap-2 py-0.5 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="checkbox checkbox-xs checkbox-primary shrink-0"
                          checked={checked}
                          onChange={() => {
                            setValue('sites', toggleItem(siteIds, id))
                          }}
                        />
                        <span className="text-sm truncate min-w-0">{s.name}</span>
                        {s.is_closed ? (
                          <span className="badge badge-ghost badge-xs shrink-0">
                            কমপ্লিট
                          </span>
                        ) : null}
                      </label>
                    )
                  })
                )}
              </div>
              {errors.sites ? (
                <span className="label-text-alt text-error mt-0.5">
                  {errors.sites.message}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex gap-2 pt-3 mt-2 shrink-0 border-t border-base-300">
            <button
              type="button"
              className="btn btn-outline btn-primary btn-sm flex-1"
              disabled={saveDisabled}
              onClick={onSaveAndCreateAnother}
            >
              আরেকটি
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm flex-1"
              disabled={saveDisabled}
            >
              {busy ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                'সংরক্ষণ'
              )}
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop">
        <button type="button" tabIndex={-1} aria-hidden="true" />
      </div>
    </dialog>
  )
})
