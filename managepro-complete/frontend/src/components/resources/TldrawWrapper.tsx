import React, { useCallback, useEffect, useState } from 'react'
import { Tldraw, TLEditorSnapshot } from '@tldraw/tldraw'
import '@tldraw/tldraw/tldraw.css'
import { whiteboardApi } from '../../api'
import { debounce } from '../../utils'

interface Props {
  projectId: string
  blockId?: string
}

const TldrawWrapper: React.FC<Props> = ({ projectId, blockId }) => {
  const [wbId, setWbId] = useState<string | null>(null)
  const [initialData, setInitialData] = useState<any>(null)

  useEffect(() => {
    loadWhiteboard()
  }, [projectId, blockId])

  async function loadWhiteboard() {
    try {
      const res = await whiteboardApi.get(projectId, blockId)
      setWbId(res.data.id || null)
      try {
        setInitialData(res.data.data ? JSON.parse(res.data.data) : null)
      } catch {
        setInitialData(null)
      }
    } catch {}
  }

  const saveWhiteboard = useCallback(
    debounce(async (snapshot: any) => {
      if (!wbId) return
      try {
        await whiteboardApi.update(wbId, { data: snapshot })
      } catch {}
    }, 2000),
    [wbId]
  )

  return (
    <Tldraw
      snapshot={initialData}
      onMount={(editor) => {
        editor.on('change', () => {
          saveWhiteboard(editor.getSnapshot())
        })
      }}
    />
  )
}

export default TldrawWrapper
