"""Import the provided archive, preserving results and source metadata."""
from pathlib import Path
from io import BytesIO
import hashlib, json, zipfile
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = Path('C:/Users/Administrator/Downloads/seedream5flash.zip')
RUN = 'seedream-5.0-flash-import20261009'
records = []
prepared = []
with zipfile.ZipFile(ARCHIVE) as archive:
    for entry in archive.namelist():
        if not entry.endswith('/result.png'):
            continue
        _, task, original_run, _ = entry.split('/')
        if task.startswith('QualityStudy-'):
            directory = ROOT/'QualityStudy20260911'/task.removeprefix('QualityStudy-')
        elif task in {'RemoveAllPeople', 'BlackGoldGrade', 'HumanAnimalPoseEdit'}:
            directory = ROOT/'scores/edit-trials-20260909'/task
        elif task == 'InteriorDesignRender-legacy':
            directory = ROOT/'InteriorDesignRender'
        else:
            directory = ROOT/task
        if not directory.is_dir():
            raise ValueError(f'Unknown task: {task}')
        prefix = entry.rsplit('/', 1)[0]+'/'
        data = archive.read(entry)
        with Image.open(BytesIO(data)) as im:
            width, height = im.size
            im.verify()
        original_meta = archive.read(prefix+'meta.json')
        meta = json.loads(original_meta)
        if meta.get('task_id') != task:
            raise ValueError(f'Metadata task mismatch: {task}')
        digest = hashlib.sha256(data).hexdigest()
        destination = directory/RUN
        target = destination/'result.png'
        if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() != digest:
            raise ValueError(f'Existing result differs: {target}')
        meta.update(model='Seedream 5.0 Flash', imported_on='2026-10-09',
                    source_archive=str(ARCHIVE), archive_entry=entry,
                    sha256=digest, width=width, height=height,
                    reference_provenance='PDF embedded images, per supplied report',
                    assessment_source='Supplied archive; comments are not independently verified')
        prompt = archive.read(prefix+'prompt.txt') if prefix+'prompt.txt' in archive.namelist() else None
        if prompt is not None:
            meta.update(prompt=prompt.decode('utf-8-sig'), prompt_source='Archive prompt.txt',
                        prompt_sha256=hashlib.sha256(prompt.decode('utf-8-sig').encode()).hexdigest())
        if task == 'ComicSixPanel':
            meta['task_version'] = '2.0'
        prepared.append((destination, data, original_meta, meta, prompt))
        records.append(dict(task=task, destination=str(target), width=width, height=height, sha256=digest))
    if len(prepared) != 18:
        raise ValueError(f'Expected 18 results, got {len(prepared)}')
    report = archive.read('source/README.md')

for destination, data, original_meta, meta, prompt in prepared:
    destination.mkdir(parents=True, exist_ok=True)
    (destination/'result.png').write_bytes(data)
    (destination/'source-meta.json').write_bytes(original_meta)
    (destination/'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')
    if prompt is not None:
        (destination/'prompt.txt').write_bytes(prompt)
    assert hashlib.sha256((destination/'result.png').read_bytes()).hexdigest() == meta['sha256']

audit = ROOT/'imports'/RUN
audit.mkdir(parents=True, exist_ok=True)
(audit/'README.md').write_bytes(report)
(audit/'manifest.json').write_text(json.dumps(dict(source_archive=str(ARCHIVE),
    archive_sha256=hashlib.sha256(ARCHIVE.read_bytes()).hexdigest(), results=records), ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Imported {len(records)} verified images with exact byte copies.')
