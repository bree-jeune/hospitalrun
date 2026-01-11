import isEmpty from 'lodash/isEmpty'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import PatientRepository from '../../shared/db/PatientRepository'
import Allergy from '../../shared/model/Allergy'
import { uuid } from '../../shared/util/uuid'
import validateAllergy from '../util/validate-allergy'

interface AddAllergyRequest {
  patientId: string
  allergy: Omit<Allergy, 'id'>
}

async function addAllergy(request: AddAllergyRequest): Promise<Allergy[]> {
  const error = validateAllergy(request.allergy)

  if (isEmpty(error)) {
    const patient = await PatientRepository.find(request.patientId)
    const allergies = patient.allergies ? [...patient.allergies] : []
    const newAllergy: Allergy = {
      id: uuid(),
      ...request.allergy,
    }
    allergies.push(newAllergy)

    await PatientRepository.saveOrUpdate({
      ...patient,
      allergies,
    })

    return allergies
  }

  throw error
}

export default function useAddAllergy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: addAllergy,
    onSuccess: async (data, variables) => {
      queryClient.setQueryData(['allergies', variables.patientId], data)
    },
  })
}
