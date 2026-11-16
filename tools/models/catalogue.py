"""Which model fills which art slot. Writes every model to tools/models/out/*.glb and the list to models.json,
which tools/render3d.py renders into art/.

  python3 tools/models/catalogue.py            all models
  python3 tools/models/catalogue.py homes      just one group (homes, workshops, farms, civic, decor, resources)

Each entry: slot, the function that builds the model, and render settings:
  tiles   footprint in tiles [w, h]     turn  render a turned version too (buildings that can face the other way)
  anchor  'front' (buildings) | 'centre' (trees, rocks: the tile's middle)
  seasons render spring/summer/autumn/winter separately (leafy things); otherwise one picture plus a winter one
  frames  a list of functions: one picture per frame, side by side (variety: "random": true; animation: "fps")
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import write_glb

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')


def groups():
    import homes
    G = {'homes': [(f'building/house/{i}', f, {'tiles': [1, 1], 'turn': True}) for i, f in enumerate(homes.HOUSE)]
                  + [(f'building/farmhouse/{i}', (lambda i=i: homes.farmhouse(i)), {'tiles': [2, 2]}) for i in range(3)]
                  + [('building/lodge', homes.lodge, {'tiles': [2, 2]})]
                  + [('building/house-brick/5', homes.brick_house, {'tiles': [1, 1], 'turn': True}), ('building/house-brick/6', homes.fine_brick_house, {'tiles': [1, 1], 'turn': True})]}
    for name in ('workshops', 'farms', 'civic', 'decor', 'resources', 'interiors'):
        try: G[name] = __import__(name).MODELS
        except ImportError: pass
    return G


def build(only=None):
    os.makedirs(OUT, exist_ok=True)
    entries = []
    for gname, items in groups().items():
        if only and gname not in only: continue
        for slot, fn, meta in items:
            base = slot.replace('/', '-')
            fns = meta.pop('frames', None) or [fn]
            files = []
            for i, f in enumerate(fns):
                name = base + (f'-f{i}' if len(fns) > 1 else '') + '.glb'
                write_glb(f(), os.path.join(OUT, name), base); files.append('out/' + name)
            e = {'slot': slot, 'group': gname, 'file': files[0], **meta}
            if len(files) > 1: e['frames'] = files
            entries.append(e)
    json.dump({'models': entries}, open(os.path.join(HERE, 'models.json'), 'w'), indent=1)
    if not only or 'interiors' in only:   # what the game needs to know about rooms and props
        import interiors; interiors.write_spec(os.path.join(HERE, '..', '..', 'art', 'interior', 'rooms.json'))
    print(f'{len(entries)} models → tools/models/out, models.json')


if __name__ == '__main__':
    build(sys.argv[1:] or None)
