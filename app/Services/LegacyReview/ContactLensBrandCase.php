<?php

namespace App\Services\LegacyReview;

use App\Support\LegacyContactLens;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Marca escrita en "Material" del lente definitivo.
 *
 * Antes de existir "Observaciones del lente definitivo" la optica anotaba la
 * marca ("Biofinity", "Optix Toric") en Material. Este caso lista todo Material
 * escrito y permite pasarlo a esas observaciones como "Marca: ...". Nada viene
 * marcado: solo la optica sabe si es una marca o un material. Incluye
 * consultas nuevas, porque el dato tambien se escribio a mano.
 */
class ContactLensBrandCase extends BaseLegacyReviewCase
{
    public const KEY = 'lc-marca-material';

    public const RULE = 'revision_lc_marca';

    private const EYES = ['od', 'oi'];

    /** Palabras de un material, no de una marca: se avisa para ayudar a decidir. */
    private const MATERIAL_WORDS = '/\b(blando|blandos|hidrogel|silicona|sil|gp|rgp|r[ií]gido|hema|t[oó]rico|t[oó]ricos)\b/iu';

    public function key(): string
    {
        return self::KEY;
    }

    public function rule(): string
    {
        return self::RULE;
    }

    public function label(): string
    {
        return 'Marca escrita en "Material" del lente definitivo';
    }

    public function description(): string
    {
        return 'La marca de los lentes ("Biofinity", "Optix Toric") se anotaba en "Material". Corregir la pasa a '
            .'"Observaciones del lente definitivo" como "Marca: ..." y deja Material vacío. Nada viene marcado: '
            .'elija solo las que son una marca.';
    }

    public function legacyOnly(): bool
    {
        return false;
    }

    public function columns(): array
    {
        return [['key' => 'material', 'label' => 'Material']];
    }

    public function rowColumns(): array
    {
        return [['key' => 'observacion', 'label' => 'Observaciones del lente definitivo']];
    }

    public function statuses(): array
    {
        return [
            'mover' => ['label' => 'Pasar a observaciones', 'tone' => 'ok'],
            'sin_dato' => ['label' => 'Sin dato', 'tone' => 'muted'],
        ];
    }

    public function flags(): array
    {
        return [
            ...parent::flags(),
            'parece_material' => [
                'label' => 'Parece un material',
                'tone' => 'warn',
                'title' => 'El texto tiene palabras de un material (blando, hidrogel, silicona, GP...). Revisar antes de mover.',
            ],
        ];
    }

    public function filters(): array
    {
        return [
            ...parent::filters(),
            ['value' => 'parece_material', 'label' => 'Parece un material', 'match' => ['flag', 'parece_material']],
        ];
    }

    public function cards(): array
    {
        return [
            ['label' => 'Con material escrito', 'match' => ['all']],
            ['label' => 'Parece un material', 'match' => ['flag', 'parece_material'], 'tone' => 'warn'],
            ['label' => 'Editadas en el sistema', 'match' => ['flag', 'editada'], 'tone' => 'warn'],
            ['label' => 'Ya corregidas', 'match' => ['applied'], 'tone' => 'muted'],
        ];
    }

    public function candidates(Builder $query): Builder
    {
        return $query->whereExists(fn ($s) => $s->select(DB::raw(1))
            ->from('consultation_contact_lens_modules as m')
            ->whereColumn('m.consultation_id', 'c.id')
            ->where('m.final_lens', 'like', '%"material"%'));
    }

    public function evaluate(array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        $consultations = $this->consultations($ids);
        $modules = $this->contactLensModules($ids);
        $edited = $this->editedIds($ids);

        $rows = [];
        foreach ($ids as $id) {
            $consultation = $consultations->get($id);
            $module = $modules->get($id);
            if ($consultation !== null && $module !== null) {
                $rows[$id] = $this->row($consultation, $module, isset($edited[$id]));
            }
        }

        return $rows;
    }

    private function row(object $c, object $module, bool $edited): array
    {
        $lens = $this->decodeJson($module->final_lens);
        $observacion = $this->clean($lens['observacion'] ?? null);

        $materials = [];
        $eyes = [];
        foreach (self::EYES as $eye) {
            $material = is_array($lens[$eye] ?? null) ? $this->clean($lens[$eye]['material'] ?? null) : null;
            if ($material !== null) {
                $materials[$eye] = $material;
            }
            $eyes[$eye] = [
                'status' => $material === null ? 'sin_dato' : 'mover',
                'current' => ['material' => $material],
                'proposed' => ['material' => null],
            ];
        }

        if ($materials === []) {
            return [...$this->baseRow($c), 'status' => LegacyReviewService::STATUS_OK, 'selectable' => false,
                'preselected' => false, 'flags' => [], 'fields' => [], 'eyes' => [], 'changes' => []];
        }

        $unique = array_values(array_unique(array_map('mb_strtolower', $materials)));
        $note = count($unique) === 1
            ? 'Marca: '.reset($materials)
            : 'Marca: '.implode(' / ', array_map(fn ($eye, $value) => strtoupper($eye).' '.$value, array_keys($materials), $materials));

        $newLens = $lens;
        foreach (array_keys($materials) as $eye) {
            $newLens[$eye]['material'] = null;
        }
        $newObservacion = LegacyContactLens::appendNote($observacion, $note);
        $newLens['observacion'] = $newObservacion;

        $flags = [];
        if ($edited) {
            $flags[] = 'editada';
        }
        if (preg_match(self::MATERIAL_WORDS, implode(' ', $materials)) === 1) {
            $flags[] = 'parece_material';
        }

        return [
            ...$this->baseRow($c),
            'status' => 'mover',
            'selectable' => true,
            'preselected' => false,
            'flags' => $flags,
            'fields' => ['observacion' => ['current' => $observacion, 'proposed' => $newObservacion]],
            'eyes' => $eyes,
            'changes' => [
                $this->change('consultation_contact_lens_modules', (int) $module->id, 'final_lens', $module->final_lens, $this->encodeJson($newLens), 'lentes'),
            ],
        ];
    }
}
