"""Bộ dựng tệp .drawio tối giản cho báo cáo JAPANO.

Mục tiêu: sơ đồ trong báo cáo phải có FILE NGUỒN chỉnh sửa được, không phải ảnh
bitmap sinh ra rồi vứt đi. Mỗi hàm ở đây trả về XML draw.io hợp lệ; script
build_diagrams.py mô tả nội dung, còn tệp này chỉ lo phần cú pháp.
"""
from xml.sax.saxutils import escape as _escape


def escape(value):
    """Escape cho GIÁ TRỊ THUỘC TÍNH XML — phải gồm cả dấu nháy kép."""
    # style luôn bật html=1 nên xuống dòng phải là <br>, không phải ký tự \n:
    # draw.io gộp \n thành khoảng trắng và nhãn nhiều dòng sẽ dính thành một dòng.
    return _escape(str(value), {'"': '&quot;', "'": '&apos;'}).replace('\n', '&lt;br&gt;')

PALETTE = {
    'actor':   'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;fontSize=12;',
    'usecase': 'ellipse;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#243244;fontSize=11;spacing=2;',
    'ucai':    'ellipse;whiteSpace=wrap;html=1;fillColor=#FDF3F1;strokeColor=#A33A2F;fontSize=11;',
    'box':     'rounded=0;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#243244;fontSize=11;',
    'boxred':  'rounded=0;whiteSpace=wrap;html=1;fillColor=#FDF3F1;strokeColor=#A33A2F;fontSize=11;',
    'boxgrey': 'rounded=0;whiteSpace=wrap;html=1;fillColor=#F2F2F0;strokeColor=#6B7255;fontSize=11;',
    'boxblue': 'rounded=0;whiteSpace=wrap;html=1;fillColor=#EEF2F7;strokeColor=#243244;fontSize=11;',
    'store':   'shape=cylinder3;boundedLbl=1;backgroundOutline=1;size=12;whiteSpace=wrap;html=1;fillColor=#F2F2F0;strokeColor=#243244;fontSize=11;',
    'round':   'rounded=1;arcSize=40;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#243244;fontSize=11;',
    'decision':'rhombus;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#A33A2F;fontSize=10;',
    'note':    'shape=note;whiteSpace=wrap;html=1;size=14;fillColor=#FFFBE6;strokeColor=#B7A66B;fontSize=10;align=left;verticalAlign=top;spacing=6;',
    'sysbox':  'rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#243244;dashed=1;verticalAlign=top;fontSize=12;fontStyle=1;spacingTop=6;',
    'life':    'shape=umlLifeline;perimeter=lifelinePerimeter;whiteSpace=wrap;html=1;container=1;collapsible=0;dropTarget=0;recursiveResize=0;outlineConnect=0;fillColor=#FFFFFF;strokeColor=#243244;fontSize=11;size=40;',
    'lifeai':  'shape=umlLifeline;perimeter=lifelinePerimeter;whiteSpace=wrap;html=1;container=1;collapsible=0;dropTarget=0;recursiveResize=0;outlineConnect=0;fillColor=#FDF3F1;strokeColor=#A33A2F;fontSize=11;size=40;',
}
EDGE = {
    'solid':  'edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeColor=#243244;fontSize=10;endArrow=block;endFill=1;',
    'plain':  'edgeStyle=none;rounded=0;html=1;strokeColor=#243244;fontSize=10;endArrow=none;',
    'dash':   'edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeColor=#6B7255;dashed=1;fontSize=10;endArrow=open;',
    'msg':    'html=1;verticalAlign=bottom;endArrow=block;endFill=1;strokeColor=#243244;fontSize=10;',
    'ret':    'html=1;verticalAlign=bottom;endArrow=open;dashed=1;strokeColor=#6B7255;fontSize=10;',
    'include':'edgeStyle=none;html=1;dashed=1;endArrow=open;strokeColor=#6B7255;fontSize=10;',
}


class Page:
    def __init__(self, name, width=1600, height=1100):
        self.name, self.width, self.height = name, width, height
        self.cells, self._n = [], 1

    def _id(self, prefix='n'):
        self._n += 1
        return f'{prefix}{self._n}'

    def node(self, label, x, y, w, h, style='box', ident=None, parent='1'):
        ident = ident or self._id()
        st = PALETTE.get(style, style)
        self.cells.append(
            f'<mxCell id="{ident}" value="{escape(str(label))}" style="{st}" vertex="1" parent="{parent}">'
            f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>')
        return ident

    def edge(self, src, dst, label='', style='solid', ident=None):
        ident = ident or self._id('e')
        st = EDGE.get(style, style)
        self.cells.append(
            f'<mxCell id="{ident}" value="{escape(str(label))}" style="{st}" edge="1" parent="1" '
            f'source="{src}" target="{dst}"><mxGeometry relative="1" as="geometry"/></mxCell>')
        return ident

    def free_edge(self, x1, y1, x2, y2, label='', style='msg'):
        ident = self._id('e')
        st = EDGE.get(style, style)
        self.cells.append(
            f'<mxCell id="{ident}" value="{escape(str(label))}" style="{st}" edge="1" parent="1">'
            f'<mxGeometry relative="1" as="geometry">'
            f'<mxPoint x="{x1}" y="{y1}" as="sourcePoint"/>'
            f'<mxPoint x="{x2}" y="{y2}" as="targetPoint"/></mxGeometry></mxCell>')
        return ident

    def xml(self):
        body = ''.join(self.cells)
        return (f'<diagram name="{escape(self.name)}">'
                f'<mxGraphModel dx="1200" dy="800" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" '
                f'arrows="1" fold="1" page="1" pageScale="1" pageWidth="{self.width}" pageHeight="{self.height}" '
                f'math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>{body}</root></mxGraphModel></diagram>')


def write(path, pages):
    if isinstance(pages, Page):
        pages = [pages]
    xml = '<mxfile host="japano-report" type="device">' + ''.join(p.xml() for p in pages) + '</mxfile>'
    with open(path, 'w', encoding='utf-8') as handle:
        handle.write(xml)
    return path


def sequence(page, actors, messages, top=40, lane=230, start=120, step=52, left=60):
    """Sơ đồ tuần tự: actors = [(nhãn, style)], messages = [(từ, đến, nhãn, kiểu)].

    Vẽ lifeline thủ công thay vì dùng container UML để đường đo được và không
    phụ thuộc trình dựng — bản export PNG phải giống hệt tệp nguồn.
    """
    xs = {}
    for index, (label, style) in enumerate(actors):
        x = left + index * lane
        xs[label] = x + 85
        page.node(label, x, top, 170, 46, style)
        page.free_edge(x + 85, top + 46, x + 85, top + 46 + start + step * (len(messages) + 1) - 100,
                       '', 'plain')
    y = top + start
    for source, target, text, kind in messages:
        if source == target:
            page.free_edge(xs[source], y, xs[source] + 60, y, text, kind)
            page.free_edge(xs[source] + 60, y, xs[source], y + 18, '', kind)
            y += step
            continue
        page.free_edge(xs[source], y, xs[target], y, text, kind)
        y += step
    return y
