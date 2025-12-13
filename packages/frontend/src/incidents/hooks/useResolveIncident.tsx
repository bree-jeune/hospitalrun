import { useMutation, useQueryClient } from '@tanstack/react-query'

import IncidentRepository from '../../shared/db/IncidentRepository'
import Incident from '../../shared/model/Incident'

function resolveIncident(incident: Incident): Promise<Incident> {
  return IncidentRepository.saveOrUpdate({
    ...incident,
    resolvedOn: new Date(Date.now()).toISOString(),
    status: 'resolved',
  })
}

export default function useResolveIncident() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: resolveIncident,
    onSuccess: async (data: Incident) => {
      queryClient.setQueryData(['incident', data.id], data)
    },
  })
}
