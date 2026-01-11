import isEmpty from 'lodash/isEmpty'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import LabRepository from '../../shared/db/LabRepository'
import Lab from '../../shared/model/Lab'
import { validateLabRequest } from '../utils/validate-lab'

function requestLab(newLab: Lab): Promise<Lab> {
  const requestLabErrors = validateLabRequest(newLab)

  if (isEmpty(requestLabErrors)) {
    newLab.requestedOn = new Date(Date.now().valueOf()).toISOString()
    return LabRepository.save(newLab)
  }

  throw requestLabErrors
}

export default function useRequestLab() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: requestLab,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['labs'] })
    },
  })
}
