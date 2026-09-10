"""Refine the existing Campus Hero in Higgsfield's Blender worker.
Run against an inspected revision; bpy and artifacts are supplied by 3D Jutsu.
Coordinates passed to helpers match the website's Y-up coordinates.
"""
import math
import bpy
from mathutils import Vector

scene = bpy.context.scene
def P(x, y, z):
    return Vector((x, -z, y))

def material(name, rgb, emission=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    rgba = (*rgb, 1.0)
    m.diffuse_color = rgba
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value = rgba
        bsdf.inputs['Roughness'].default_value = 0.55
        bsdf.inputs['Metallic'].default_value = 0.08
        bsdf.inputs['Emission Color'].default_value = rgba
        bsdf.inputs['Emission Strength'].default_value = emission
    return m

materials = {
    'campusFloor': material('campusFloor', (0.10, 0.19, 0.27)),
    'campusTrim': material('campusTrim', (0.18, 0.77, 0.83), 0.25),
    'campusIvory': material('campusIvory', (0.77, 0.85, 0.91)),
    'campusGold': material('campusGold', (0.97, 0.68, 0.26)),
}
material('wood', (0.46, 0.35, 0.26))
material('deckTop', (0.095, 0.12, 0.22))
material('panelLight', (0.30, 0.37, 0.56))
material('screen', (0.28, 0.70, 0.82), 0.35)

def cube(name, pos, dims, mat):
    obj = bpy.data.objects.get(name)
    if obj is None:
        bpy.ops.mesh.primitive_cube_add(size=1, location=P(*pos))
        obj = bpy.context.object
        obj.name = name
    obj.location = P(*pos)
    obj.scale = (dims[0], dims[2], dims[1])
    obj.data.materials.clear()
    obj.data.materials.append(bpy.data.materials.get(mat) or materials[mat])
    return obj

# A low floor insert identifies the practice zone without covering the furniture.
cube('Desk0_CampusFloor', (-8.0, 0.065, 2.0), (9.8, 0.025, 12.0), 'campusFloor')
cube('Desk0_CampusFrontEdge', (-8.0, 0.095, 7.94), (9.8, 0.025, 0.08), 'campusTrim')
cube('Desk0_CampusSideEdge', (-3.14, 0.095, 2.0), (0.08, 0.025, 12.0), 'campusTrim')

# Open architectural frame, keeping every workstation visible from the scroll path.
for i, x in enumerate((-12.6, -3.4)):
    cube('Desk0_CampusFramePost_' + str(i), (x, 3.17, -3.6), (0.24, 6.2, 0.24), 'panelLight')
    cube('Desk0_CampusFrameFoot_' + str(i), (x, 0.18, -3.6), (0.65, 0.26, 0.65), 'panel')
cube('Desk0_CampusFrameHeader', (-8.0, 6.27, -3.6), (9.44, 0.28, 0.30), 'campusIvory')
cube('Desk0_CampusFrameLight', (-8.0, 6.10, -3.43), (8.7, 0.065, 0.075), 'campusTrim')
for i, mat in enumerate(('aqua', 'brand', 'sun')):
    cube('Desk0_CampusFrameMarker_' + str(i), (-8.8 + i * 0.8, 6.28, -3.425), (0.52, 0.11, 0.04), mat)

# Graphics are real mesh strips so the site's texture-free renderer retains them.
bpy.context.view_layer.update()
board = bpy.data.objects['Board_Surface']
for i, (length, mat) in enumerate(((3.5, 'brand'), (2.5, 'aqua'), (3.9, 'panelLight'), (1.8, 'sun'))):
    bar = cube('Board_LessonLine_' + str(i), (0,0,0), (0.018, 0.09, length), mat)
    bar.location = board.matrix_world @ Vector((1.7, -0.12, 0.62 - i * 0.34))
    bar.rotation_euler = board.rotation_euler
for i in range(3):
    bar = cube('Board_LessonNode_' + str(i), (0,0,0), (0.02, 0.28, 0.28), 'campusTrim')
    bar.location = board.matrix_world @ Vector((1.8, 0.78, 0.57 - i * 0.50))
    bar.rotation_euler = board.rotation_euler

screens = [o for o in scene.objects if o.name.startswith('Desk') and o.name.endswith('_LapScreen')]
for screen in screens:
    prefix = screen.name.removesuffix('_LapScreen')
    for i, (length, mat) in enumerate(((0.85, 'bone'), (0.60, 'brand'), (0.77, 'bone'), (0.44, 'sun'))):
        bar = cube(prefix + '_CodeLine_' + str(i), (0,0,0), (length, 0.048, 0.012), mat)
        bar.location = screen.matrix_world @ Vector((-0.15, -1.7, 0.60 - i * 0.32))
        bar.rotation_euler = screen.rotation_euler

# Low-cost circular mesh with shared vertices, portable to GLB and Canvas.
def ring(name, center, radius, thickness, axis, mat, segments=40):
    obj = bpy.data.objects.get(name)
    if obj:
        return obj
    verts, faces = [], []
    normal = Vector(axis).normalized()
    tangent = normal.cross(Vector((0,0,1)))
    if tangent.length < 0.01:
        tangent = normal.cross(Vector((0,1,0)))
    tangent.normalize()
    bitangent = normal.cross(tangent).normalized()
    for i in range(segments):
        angle = 2 * math.pi * i / segments
        radial = math.cos(angle)*tangent + math.sin(angle)*bitangent
        for j in range(4):
            a = 2 * math.pi * j / 4
            q = P(*center) + radial*(radius + thickness*math.cos(a)) + normal*thickness*math.sin(a)
            verts.append(tuple(q))
    for i in range(segments):
        for j in range(4):
            a = i*4+j
            b = ((i+1)%segments)*4+j
            faces.append((a,b,((i+1)%segments)*4+(j+1)%4,i*4+(j+1)%4))
    mesh = bpy.data.meshes.new(name + '_Mesh')
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    obj.data.materials.append(bpy.data.materials[mat])
    return obj

ring('Hub_CampusOrbit', (0,6.2,0), 2.85, 0.045, (0.30,0.50,0.81), 'campusTrim', 40)
ring('Globe_CampusMeridian', (10.4,2.5,-7.2), 1.16, 0.028, (1,0.2,0), 'campusGold', 24)
ring('Globe_CampusEquator', (10.4,2.5,-7.2), 1.15, 0.024, (0,0,1), 'campusIvory', 24)

# Softer light and a wider delivery camera for a complete, readable campus.
key = bpy.data.objects['KeyLight']
key.data.energy = 2.4
key.data.angle = math.radians(14)
fill = bpy.data.objects['FillLight']
fill.data.type = 'POINT'
fill.data.energy = 2300
fill.data.shadow_soft_size = 9
fill.data.color = (0.58,0.73,1.0)
bpy.data.objects['CoreGlow'].data.energy = 240
if scene.world and scene.world.use_nodes:
    background = scene.world.node_tree.nodes.get('Background')
    if background:
        background.inputs['Color'].default_value = (0.07,0.10,0.22,1)
        background.inputs['Strength'].default_value = 0.35

cam = bpy.data.objects['DeliveryCamera']
cam.location = (34,-43,35)
target = Vector((0,0,0.3))
cam.rotation_euler = (target-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.lens = 45
scene.camera = cam
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1280
scene.render.resolution_y = 800
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
if hasattr(scene.render.image_settings, 'media_type'):
    scene.render.image_settings.media_type = 'IMAGE'
bpy.context.view_layer.update()

artifact = artifacts.file(name='campus-refined.png', media_type='image/png')
scene.render.filepath = artifact.path
bpy.ops.render.render(write_still=True)
artifact.publish()
result = {
    'objectCount':len(scene.objects),
    'addedObjects':[o.name for o in scene.objects if 'Campus' in o.name or 'CodeLine' in o.name or 'Lesson' in o.name],
    'deliveryCamera':list(cam.location),
    'materials':[m.name for m in materials.values()],
}
