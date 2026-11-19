import {Document, Paragraph, TextRun, Packer, LevelFormat, HeadingLevel, UnderlineType} from 'docx';

function inline(node) {
  if (node.type === 'hardBreak') return new TextRun({break: 1});
  const marks = new Set((node.marks || []).map(mark => mark.type));
  return new TextRun({
    text: node.text, bold: marks.has('bold') || undefined, italics: marks.has('italic') || undefined,
    strike: marks.has('strike') || undefined,
    underline: marks.has('underline') ? {type: UnderlineType.SINGLE} : undefined,
  });
}

export async function wordDocument(doc) {
  const paragraphs = [], lists = [];
  function visit(node, depth = 0, quoteDepth = 0, numbering) {
    const children = node.content || [];
    if (node.type === 'blockquote') {
      children.forEach(child => visit(child, depth, quoteDepth + 1));
    } else if (node.type === 'orderedList' || node.type === 'bulletList') {
      const reference = 'list-' + lists.length, ordered = node.type === 'orderedList';
      const level = Math.min(depth, 8);
      lists.push({reference, levels: Array.from({length: level + 1}, (_, i) => ({
        level: i, format: ordered ? LevelFormat.DECIMAL : LevelFormat.BULLET,
        text: ordered ? '%' + (i + 1) + '.' : '•', start: ordered ? node.attrs?.start ?? 1 : 1,
        style: {paragraph: {indent: {left: 420 * (1 + i + quoteDepth), hanging: 260}}},
      }))});
      for (const item of children) {
        (item.content || []).forEach((child, index) => visit(child, depth + 1, quoteDepth, index ? undefined : {reference, level}));
      }
    } else {
      paragraphs.push(new Paragraph({
        heading: node.type === 'heading' ? (node.attrs.level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2) : undefined,
        style: quoteDepth && node.type !== 'heading' ? 'Quote' : undefined,
        numbering, indent: !numbering && depth + quoteDepth ? {left: 420 * (depth + quoteDepth)} : undefined,
        children: children.map(inline),
      }));
    }
  }
  (doc.content || []).forEach(node => visit(node));
  const font = {ascii:'Times New Roman', hAnsi:'Times New Roman', eastAsia:'宋体'};
  const heading = size => ({run:{font, size, color:'172C21', bold:true}, paragraph:{keepNext:true, spacing:{before:200, after:120}}});
  const file = new Document({
    creator:'致知写作', numbering:{config:lists},
    styles:{default:{
      document:{run:{font, size:24, color:'202820'}, paragraph:{spacing:{after:140, line:340}}},
      heading1:heading(38), heading2:heading(30),
    }, paragraphStyles:[{id:'Quote', name:'引用', basedOn:'Normal', run:{color:'425449'}, paragraph:{spacing:{before:100, after:140}}}]},
    sections:[{children:paragraphs, properties:{page:{size:{width:11906,height:16838},margin:{top:1440,bottom:1440,left:1440,right:1440}}}}],
  });
  return Packer.toBlob(file);
}
