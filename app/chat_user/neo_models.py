from neomodel import StructuredNode, StringProperty, RelationshipTo, JSONProperty

# class Document(StructuredNode):
#     name = StringProperty()
#     terms = RelationshipTo('Paragraph', 'HAS_PARAGRAPH')
#
# class Paragraph(StructuredNode):
#     content = StringProperty()
#     terms = RelationshipTo('Term', 'HAS_TERM')
#
# class Term(StructuredNode):
#     name = StringProperty(unique_index=True)

class Node(StructuredNode):
    type = StringProperty()
    name = StringProperty()
    content = StringProperty()