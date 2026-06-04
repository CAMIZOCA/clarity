<?php

namespace Database\Seeders;

use App\Models\ClinicalCatalogGroup;
use App\Models\PrintTemplate;
use Illuminate\Database\Seeder;

class ClinicalCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $groups = [
            'diagnoses' => [
                'name' => 'Diagnosticos',
                'description' => 'Diagnosticos clinicos frecuentes en optometria',
                'items' => [
                    ['code' => 'H52.1', 'label' => 'Miopia simple'],
                    ['code' => 'H52.0', 'label' => 'Hipermetropia simple'],
                    ['code' => 'H52.2', 'label' => 'Astigmatismo miopico simple'],
                    ['code' => 'H52.1 + H52.2', 'label' => 'Astigmatismo miopico compuesto'],
                    ['code' => 'H52.2 + H52.0', 'label' => 'Astigmatismo hipermetropico simple'],
                    ['code' => 'H52.2 + H52.0C', 'label' => 'Astigmatismo hipermetropico compuesto'],
                    ['code' => 'H52.3', 'label' => 'Astigmatismo mixto'],
                    ['code' => 'H53.0', 'label' => 'Ambliopia'],
                    ['code' => 'H53.5', 'label' => 'Daltonismo'],
                    ['code' => 'H52.4', 'label' => 'Presbicia'],
                    ['code' => 'H52.31', 'label' => 'Antimetropia'],
                    ['code' => 'H52.32', 'label' => 'Anisometropia'],
                    ['code' => 'H52.5', 'label' => 'Trastornos de acomodacion'],
                    ['code' => 'H52.4 + H52.1', 'label' => 'Miopia con presbicia'],
                    ['code' => 'H52.4 + H52.0', 'label' => 'Hipermetropia con presbicia'],
                ],
            ],
            'lens_materials' => [
                'name' => 'Materiales de lunas',
                'items' => [
                    ['label' => 'CR-39'],
                    ['label' => 'Policarbonato'],
                    ['label' => 'Trivex'],
                    ['label' => 'High Index 1.56'],
                    ['label' => 'High Index 1.61'],
                    ['label' => 'High Index 1.67'],
                    ['label' => 'High Index 1.74'],
                    ['label' => 'Bifocal'],
                    ['label' => 'Progresivo'],
                ],
            ],
            'lens_thicknesses' => [
                'name' => 'Espesores de lunas',
                'items' => [
                    ['label' => 'Estandar'],
                    ['label' => 'Reducido'],
                    ['label' => 'Ultra delgado'],
                ],
            ],
            'lens_protections' => [
                'name' => 'Protecciones de lunas',
                'items' => [
                    ['label' => 'Antirreflejo'],
                    ['label' => 'Filtro azul'],
                    ['label' => 'Fotocromatico'],
                    ['label' => 'UV'],
                    ['label' => 'Endurecido'],
                    ['label' => 'Polarizado'],
                    ['label' => 'Antirreflejo + filtro azul'],
                    ['label' => 'Fotocromatico + UV'],
                ],
            ],
            'recommendations' => [
                'name' => 'Recomendaciones medicas',
                'items' => [
                    ['label' => 'Uso permanente'],
                    ['label' => 'Uso para tareas escolares'],
                    ['label' => 'Examen oftalmologico urgente'],
                    ['label' => 'Medir presion intraocular urgente para descartar glaucoma'],
                    ['label' => 'Examen de tonometria, descartar glaucoma'],
                    ['label' => 'Examen de glucosa, descartar diabetes'],
                    ['label' => 'Uso permanente / pausas de pantallas cada 20 minutos / control en 1 ano'],
                    ['label' => 'Uso para cerca / computador'],
                ],
            ],
            'contact_lens_types' => [
                'name' => 'Tipos de lentes de contacto',
                'items' => [
                    ['label' => 'Blanda esferica'],
                    ['label' => 'Blanda torica'],
                    ['label' => 'Rigida gas permeable'],
                    ['label' => 'Escleral'],
                    ['label' => 'Terapeutica'],
                ],
            ],
        ];

        foreach ($groups as $key => $groupData) {
            $group = ClinicalCatalogGroup::query()->updateOrCreate(
                ['key' => $key],
                [
                    'name' => $groupData['name'],
                    'description' => $groupData['description'] ?? null,
                ]
            );

            foreach ($groupData['items'] as $index => $item) {
                $group->items()->updateOrCreate(
                    [
                        'label' => $item['label'],
                        'code' => $item['code'] ?? null,
                    ],
                    [
                        'key' => $item['key'] ?? null,
                        'description' => $item['description'] ?? null,
                        'sort_order' => $index + 1,
                        'is_active' => true,
                    ]
                );
            }
        }

        $templates = [
            ['key' => 'rx-final', 'name' => 'Receta RX Final', 'description' => 'Prescripcion de lejos con formula final'],
            ['key' => 'vision-cerca', 'name' => 'Receta V. Cerca', 'description' => 'Receta para vision de cerca'],
            ['key' => 'receta-clasica', 'name' => 'Receta', 'description' => 'Formato general de receta'],
            ['key' => 'receta-alternativa', 'name' => 'Receta 2', 'description' => 'Formato alternativo de receta'],
            ['key' => 'certificado-membretado', 'name' => 'Certificado membretada', 'description' => 'Certificado clinico con membrete'],
            ['key' => 'certificado-medidas', 'name' => 'Certificado con medidas', 'description' => 'Certificado que incluye parametros opticos'],
            ['key' => 'certificado-sin-medidas', 'name' => 'Certificado sin medidas', 'description' => 'Certificado clinico resumido'],
            ['key' => 'ficha-completa', 'name' => 'Ficha', 'description' => 'Resumen integral de la consulta'],
        ];

        foreach ($templates as $index => $template) {
            PrintTemplate::query()->updateOrCreate(
                ['key' => $template['key']],
                [
                    'name' => $template['name'],
                    'description' => $template['description'],
                    'sort_order' => $index + 1,
                    'is_active' => true,
                    'sections' => [],
                ]
            );
        }
    }
}
