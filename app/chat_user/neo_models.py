from neomodel import StructuredNode, StringProperty, RelationshipTo

class Document(StructuredNode):
    name = StringProperty()
    terms = RelationshipTo('Paragraph', 'HAS_PARAGRAPH')

class Paragraph(StructuredNode):
    content = StringProperty()
    terms = RelationshipTo('Term', 'HAS_TERM')

class Term(StructuredNode):
    name = StringProperty(unique_index=True)