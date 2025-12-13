import { useMutation, useQueryClient } from '@tanstack/react-query'

import LabRepository from '../../shared/db/LabRepository'
import Lab from '../../shared/model/Lab'

function cancelLab(lab: Lab): Promise<Lab> {
  lab.canceledOn = new Date(Date.now().valueOf()).toISOString()
  lab.status = 'canceled'
  return LabRepository.saveOrUpdate(lab)
}

export default function useCancelLab() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: cancelLab,
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['labs'] })
    },
  })
}
