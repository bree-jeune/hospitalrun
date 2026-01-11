import { useMutation, useQueryClient } from '@tanstack/react-query'

import AppointmentRepository from '../../shared/db/AppointmentRepository'
import Appointment from '../../shared/model/Appointment'
import validateAppointment, { AppointmentError } from '../appointments/util/validate-appointment'

interface newAppointmentResult {
  mutate: (appointment: Appointment) => void
  isLoading: boolean
  isError: boolean
  validator(appointment: Appointment): AppointmentError
}

async function createNewAppointment(appointment: Appointment): Promise<Appointment> {
  return AppointmentRepository.save(appointment)
}

function validateCreateAppointment(appointment: Appointment): AppointmentError {
  return validateAppointment(appointment)
}

export default function useScheduleAppointment(): newAppointmentResult {
  const queryClient = useQueryClient()
  const { mutate, isPending, isError } = useMutation({
    mutationFn: createNewAppointment,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['appointment'] })
    },
  })
  const result: newAppointmentResult = {
    mutate,
    isLoading: isPending,
    isError,
    validator: validateCreateAppointment,
  }
  return result
}
