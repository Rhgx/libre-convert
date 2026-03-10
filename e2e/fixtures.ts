import { strToU8, zipSync } from 'fflate'

type UploadedFile = {
  name: string
  mimeType: string
  buffer: Buffer
}

export function createDocxFixture(): UploadedFile {
  const files = {
    '[Content_Types].xml': xml(`
      <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
        <Default Extension="xml" ContentType="application/xml"/>
        <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
      </Types>
    `),
    '_rels/.rels': xml(`
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
      </Relationships>
    `),
    'word/document.xml': xml(`
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p>
            <w:r><w:t>Libre Convert smoke test</w:t></w:r>
          </w:p>
          <w:sectPr>
            <w:pgSz w:w="12240" w:h="15840"/>
            <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
          </w:sectPr>
        </w:body>
      </w:document>
    `),
  }

  return {
    name: 'smoke.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: Buffer.from(zipSync(files)),
  }
}

export function createXlsxFixture(): UploadedFile {
  const files = {
    '[Content_Types].xml': xml(`
      <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
        <Default Extension="xml" ContentType="application/xml"/>
        <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
        <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
        <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
      </Types>
    `),
    '_rels/.rels': xml(`
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
      </Relationships>
    `),
    'xl/workbook.xml': xml(`
      <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <sheets>
          <sheet name="Sheet1" sheetId="1" r:id="rId1"/>
        </sheets>
      </workbook>
    `),
    'xl/_rels/workbook.xml.rels': xml(`
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
        <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
      </Relationships>
    `),
    'xl/worksheets/sheet1.xml': xml(`
      <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <sheetData>
          <row r="1">
            <c r="A1" t="inlineStr">
              <is><t>Libre Convert</t></is>
            </c>
            <c r="B1" t="n">
              <v>42</v>
            </c>
          </row>
        </sheetData>
      </worksheet>
    `),
    'xl/styles.xml': xml(`
      <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <fonts count="1"><font><sz val="11"/><name val="Arial"/></font></fonts>
        <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
        <borders count="1"><border/></borders>
        <cellStyleXfs count="1"><xf/></cellStyleXfs>
        <cellXfs count="1"><xf xfId="0"/></cellXfs>
      </styleSheet>
    `),
  }

  return {
    name: 'smoke.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(zipSync(files)),
  }
}

export function createPptxFixture(): UploadedFile {
  const files = {
    '[Content_Types].xml': xml(`
      <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
        <Default Extension="xml" ContentType="application/xml"/>
        <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
        <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
      </Types>
    `),
    '_rels/.rels': xml(`
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
      </Relationships>
    `),
    'ppt/presentation.xml': xml(`
      <p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:sldSz cx="9144000" cy="6858000"/>
        <p:sldIdLst>
          <p:sldId id="256" r:id="rId1"/>
        </p:sldIdLst>
      </p:presentation>
    `),
    'ppt/_rels/presentation.xml.rels': xml(`
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
      </Relationships>
    `),
    'ppt/slides/slide1.xml': xml(`
      <p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
        <p:cSld>
          <p:spTree>
            <p:nvGrpSpPr>
              <p:cNvPr id="1" name=""/>
              <p:cNvGrpSpPr/>
              <p:nvPr/>
            </p:nvGrpSpPr>
            <p:grpSpPr/>
            <p:sp>
              <p:nvSpPr>
                <p:cNvPr id="2" name="Title 1"/>
                <p:cNvSpPr/>
                <p:nvPr/>
              </p:nvSpPr>
              <p:spPr/>
              <p:txBody>
                <a:bodyPr/>
                <a:lstStyle/>
                <a:p><a:r><a:t>Libre Convert smoke test</a:t></a:r></a:p>
              </p:txBody>
            </p:sp>
          </p:spTree>
        </p:cSld>
      </p:sld>
    `),
  }

  return {
    name: 'smoke.pptx',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    buffer: Buffer.from(zipSync(files)),
  }
}

function xml(source: string): Uint8Array {
  return strToU8(source.replace(/>\s+</g, '><').trim())
}
