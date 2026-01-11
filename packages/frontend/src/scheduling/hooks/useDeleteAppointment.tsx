import { useMutation, useQueryClient } from '@tanstack/react-query'

import AppointmentRepository from '../../shared/db/AppointmentRepository'
import Appointment from '../../shared/model/Appointment'

interface deleteAppointmentRequest {
  appointmentId: string
}

async function deleteAppointment(request: deleteAppointmentRequest): Promise<Appointment> {
  const appointment = await AppointmentRepository.find(request.appointmentId)
  return AppointmentRepository.delete(appointment)
}

export default function useDeleteAppointment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteAppointment,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['appointment'] })
    },
  })
}
