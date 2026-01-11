import isEmpty from 'lodash/isEmpty'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import PatientRepository from '../../shared/db/PatientRepository'
import CarePlan from '../../shared/model/CarePlan'
import { uuid } from '../../shared/util/uuid'
import validateCarePlan from '../util/validate-careplan'

interface AddCarePlanRequest {
  patientId: string
  carePlan: Omit<CarePlan, 'id' | 'createdOn'>
}

async function addCarePlan(request: AddCarePlanRequest): Promise<CarePlan[]> {
  const error = validateCarePlan(request.carePlan)

  if (isEmpty(error)) {
    const patient = await PatientRepository.find(request.patientId)
    const carePlans = patient.carePlans ? [...patient.carePlans] : []

    const newCarePlan: CarePlan = {
      id: uuid(),
      createdOn: new Date(Date.now()).toISOString(),
      ...request.carePlan,
    }
    carePlans.push(newCarePlan)

    await PatientRepository.saveOrUpdate({
      ...patient,
      carePlans,
    })

    return carePlans
  }

  error.message = 'patient.carePlan.error.unableToAdd'
  throw error
}

export default function useAddCarePlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: addCarePlan,
    onSuccess: async (data, variables) => {
      queryClient.setQueryData(['care-plans', variables.patientId], data)
    },
  })
}
