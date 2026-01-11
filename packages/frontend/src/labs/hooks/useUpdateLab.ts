import { useMutation, useQueryClient } from '@tanstack/react-query'

import LabRepository from '../../shared/db/LabRepository'
import Lab from '../../shared/model/Lab'

function updateLab(labToUpdate: Lab): Promise<Lab> {
  return LabRepository.saveOrUpdate(labToUpdate)
}

export default function useUpdateLab() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateLab,
    onSuccess: async (data) => {
      queryClient.setQueryData(['lab', data.id], data)
      await queryClient.invalidateQueries({ queryKey: ['labs'] })
    },
  })
}
