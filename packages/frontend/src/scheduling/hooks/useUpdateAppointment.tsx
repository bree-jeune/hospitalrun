import { useMutation, useQueryClient } from '@tanstack/react-query'

import AppointmentRepository from '../../shared/db/AppointmentRepository'
import Appointment from '../../shared/model/Appointment'
import validateAppointment, { AppointmentError } from '../appointments/util/validate-appointment'

interface updateAppointmentResult {
  mutate: (appointment: Appointment) => void
  isLoading: boolean
  isError: boolean
  error: AppointmentError
}

async function updateAppointment(appointment: Appointment): Promise<Appointment> {
  return AppointmentRepository.saveOrUpdate(appointment)
}

export default function useUpdateAppointment(appointment: Appointment): updateAppointmentResult {
  const queryClient = useQueryClient()
  const updateAppointmentError = validateAppointment(appointment)
  const { mutate, isPending, isError } = useMutation({
    mutationFn: updateAppointment,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['appointment'] })
    },
  })
  const result: updateAppointmentResult = {
    mutate,
    isLoading: isPending,
    isError,
    error: updateAppointmentError,
  }
  return result
}
