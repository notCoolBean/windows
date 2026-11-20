import io
from pathlib import Path
import sys
import unittest
import zipfile

sys.path.insert(0,str(Path(__file__).resolve().parent/'office'))
from parse_document import extract


def zipped(files):
    stream=io.BytesIO()
    with zipfile.ZipFile(stream,'w') as z:
        for name,text in files.items(): z.writestr(name,text)
    return stream.getvalue()


class OfflineDocumentsTest(unittest.TestCase):
    def test_word_paragraphs(self):
        data=zipped({'word/document.xml':'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>本地资料</w:t></w:r></w:p><w:p><w:r><w:t>第二段</w:t></w:r></w:p></w:body></w:document>'})
        self.assertEqual(extract(data,'docx'),'本地资料\n第二段')

    def test_excel_shared_and_inline_values(self):
        ns='xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
        data=zipped({'xl/sharedStrings.xml':f'<sst {ns}><si><t>预算</t></si></sst>',
                     'xl/worksheets/sheet1.xml':f'<worksheet {ns}><sheetData><row><c r="A1" t="s"><v>0</v></c><c r="B1"><v>123</v></c></row></sheetData></worksheet>'})
        self.assertIn('A1: 预算 | B1: 123',extract(data,'xlsx'))

    def test_slides_numeric_order(self):
        xml='<p xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:t>{}</a:t></p>'
        data=zipped({'ppt/slides/slide10.xml':xml.format('十'),'ppt/slides/slide2.xml':xml.format('二')})
        output=extract(data,'pptx')
        self.assertLess(output.index('二'),output.index('十'))

    def test_pdf_text_and_scanned_page_rejection(self):
        from pypdf import PdfWriter
        from pypdf.generic import DictionaryObject,NameObject,DecodedStreamObject
        writer=PdfWriter();page=writer.add_blank_page(width=200,height=200)
        blank=io.BytesIO();writer.write(blank)
        with self.assertRaisesRegex(ValueError,'没有可提取的文字'): extract(blank.getvalue(),'pdf')
        font=DictionaryObject({NameObject('/Type'):NameObject('/Font'),NameObject('/Subtype'):NameObject('/Type1'),NameObject('/BaseFont'):NameObject('/Helvetica')})
        page[NameObject('/Resources')]=DictionaryObject({NameObject('/Font'):DictionaryObject({NameObject('/F1'):font})})
        content=DecodedStreamObject();content.set_data(b'BT /F1 12 Tf 20 20 Td (Offline PDF) Tj ET')
        page[NameObject('/Contents')]=content
        stream=io.BytesIO();writer.write(stream)
        self.assertIn('Offline PDF',extract(stream.getvalue(),'pdf'))


if __name__=='__main__': unittest.main()
