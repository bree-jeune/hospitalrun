import isEmpty from 'lodash/isEmpty'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import shortid from 'shortid'

import IncidentRepository from '../../shared/db/IncidentRepository'
import Incident from '../../shared/model/Incident'
import validateIncident from '../util/validate-incident'

const getIncidentCode = (): string => `I-${shortid.generate()}`

export function reportIncident(incident: Incident): Promise<Incident> {
  const error = validateIncident(incident)
  if (isEmpty(error)) {
    const updatedIncident: Incident = {
      ...incident,
      code: getIncidentCode(),
      status: 'reported',
      reportedBy: 'some user',
      reportedOn: new Date(Date.now()).toISOString(),
    }
    return IncidentRepository.save(updatedIncident)
  }

  throw error
}

export default function useReportIncident() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: reportIncident,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['incidents'] })
    },
  })
}
