import { Editor } from '@tinymce/tinymce-react'
import React from 'react'

import 'tinymce/tinymce'

// Basic tinyMCE theme & skins required for editor to display
import 'tinymce/themes/silver'
import 'tinymce/skins/ui/oxide/skin.min.css'
import 'tinymce/skins/ui/oxide/content.min.css'

// Import required plugins (paste is built-in in TinyMCE 6)
import 'tinymce/plugins/autolink'
import 'tinymce/plugins/lists'
import 'tinymce/plugins/link'
import 'tinymce/plugins/table'
import 'tinymce/plugins/charmap'

interface Props {
  /**
   * id of the rich text editor component
   * @default ""
   */
  id?: string
  /**
   *  Initial value of the rich text editor
   * @default ""
   */
  value?: string
  /**
   * Defines whether the rich text editor should be enabled/disabled (default = false)
   * @default false
   */
  disabled?: boolean
  /**
   * Height of the rich text editor
   * @default 500
   */
  height?: number
  /**
   * Method run on the editors onEditorChange event. Returns editor content as HTML.
   * @default null
   */
  onChange?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
}

const RichText = (props: Props) => {
  const { id, value, disabled, height, onChange } = props

  return (
    <Editor
      id={id}
      initialValue={value}
      init={{
        height: height || 500,
        menubar: true,
        statusbar: false,
        // skin & content_css are set to 'false' to avoid tinyMCE looking to fetch files when they are already imported above.
        skin: false,
        // eslint disabled on next line due to TinyMCE option attribute naming.
        content_css: false,
        plugins: [`autolink lists link table charmap`],
        toolbar: [
          `undo redo | formatselect fontselect fontsizeselect | bold italic underline sub sup backcolor |
        alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | table link removeformat`,
        ],
        branding: false,
      }}
      disabled={disabled}
      onEditorChange={(content) => onChange && onChange(content)}
    />
  )
}

export { RichText }
