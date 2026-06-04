<?php

namespace Database\Seeders;

use App\Models\Cie10Code;
use Illuminate\Database\Seeder;

class Cie10Seeder extends Seeder
{
    public function run(): void
    {
        $codes = [
            // Trastornos de refracción y acomodación
            ['code' => 'H52.0', 'description' => 'Hipermetropía'],
            ['code' => 'H52.1', 'description' => 'Miopía'],
            ['code' => 'H52.2', 'description' => 'Astigmatismo'],
            ['code' => 'H52.3', 'description' => 'Anisometropía y aniseiconía'],
            ['code' => 'H52.4', 'description' => 'Presbicia'],
            ['code' => 'H52.5', 'description' => 'Trastornos de la acomodación'],
            ['code' => 'H52.6', 'description' => 'Otros trastornos de refracción'],
            ['code' => 'H52.7', 'description' => 'Trastorno de la refracción, no especificado'],
            // Estrabismo
            ['code' => 'H50.0', 'description' => 'Estrabismo convergente concomitante (esotropía)'],
            ['code' => 'H50.1', 'description' => 'Estrabismo divergente concomitante (exotropía)'],
            ['code' => 'H50.2', 'description' => 'Estrabismo vertical'],
            ['code' => 'H50.3', 'description' => 'Heterotropía intermitente'],
            ['code' => 'H50.4', 'description' => 'Otras heterotropías y las no especificadas'],
            ['code' => 'H50.5', 'description' => 'Heteroforia'],
            ['code' => 'H50.6', 'description' => 'Estrabismo mecánico'],
            ['code' => 'H50.8', 'description' => 'Otros estrabismos especificados'],
            ['code' => 'H50.9', 'description' => 'Estrabismo, no especificado'],
            // Glaucoma
            ['code' => 'H40.0', 'description' => 'Sospecha de glaucoma'],
            ['code' => 'H40.1', 'description' => 'Glaucoma primario de ángulo abierto'],
            ['code' => 'H40.2', 'description' => 'Glaucoma primario de ángulo cerrado'],
            ['code' => 'H40.3', 'description' => 'Glaucoma secundario a traumatismo ocular'],
            ['code' => 'H40.4', 'description' => 'Glaucoma secundario a inflamación ocular'],
            ['code' => 'H40.5', 'description' => 'Glaucoma secundario a otros trastornos del ojo'],
            ['code' => 'H40.6', 'description' => 'Glaucoma secundario a drogas'],
            ['code' => 'H40.8', 'description' => 'Otros glaucomas'],
            ['code' => 'H40.9', 'description' => 'Glaucoma, no especificado'],
            // Cataratas
            ['code' => 'H25.0', 'description' => 'Catarata senil incipiente'],
            ['code' => 'H25.1', 'description' => 'Catarata senil nuclear'],
            ['code' => 'H25.2', 'description' => 'Catarata senil, tipo morgagniana'],
            ['code' => 'H25.8', 'description' => 'Otras cataratas seniles'],
            ['code' => 'H25.9', 'description' => 'Catarata senil, no especificada'],
            ['code' => 'H26.0', 'description' => 'Catarata infantil, juvenil y presenil'],
            ['code' => 'H26.1', 'description' => 'Catarata traumática'],
            ['code' => 'H26.2', 'description' => 'Catarata complicada'],
            ['code' => 'H26.3', 'description' => 'Catarata inducida por drogas'],
            ['code' => 'H26.4', 'description' => 'Catarata posterior secundaria'],
            // Degeneración macular
            ['code' => 'H35.3', 'description' => 'Degeneración de la mácula y del polo posterior'],
            ['code' => 'H35.30', 'description' => 'Degeneración macular no especificada'],
            ['code' => 'H35.31', 'description' => 'Degeneración macular relacionada con la edad, no exudativa (seca)'],
            ['code' => 'H35.32', 'description' => 'Degeneración macular relacionada con la edad, exudativa (húmeda)'],
            // Queratocono
            ['code' => 'H18.6', 'description' => 'Queratocono'],
            ['code' => 'H18.60', 'description' => 'Queratocono, no especificado'],
            ['code' => 'H18.61', 'description' => 'Queratocono estable'],
            ['code' => 'H18.62', 'description' => 'Queratocono inestable (hidrops agudo)'],
            // Ojo seco
            ['code' => 'H04.1', 'description' => 'Síndrome de ojo seco (disfunción lagrimal)'],
            ['code' => 'H04.12', 'description' => 'Ojo seco por deficiencia acuosa'],
            ['code' => 'H04.13', 'description' => 'Ojo seco por evaporación'],
            // Conjuntivitis
            ['code' => 'H10.0', 'description' => 'Conjuntivitis mucopurulenta'],
            ['code' => 'H10.1', 'description' => 'Conjuntivitis atópica aguda'],
            ['code' => 'H10.2', 'description' => 'Otras conjuntivitis agudas'],
            ['code' => 'H10.3', 'description' => 'Conjuntivitis aguda, no especificada'],
            ['code' => 'H10.4', 'description' => 'Conjuntivitis crónica'],
            ['code' => 'H10.5', 'description' => 'Blefaroconjuntivitis'],
            ['code' => 'H10.8', 'description' => 'Otras conjuntivitis'],
            ['code' => 'H10.9', 'description' => 'Conjuntivitis, no especificada'],
            // Pterigión
            ['code' => 'H11.0', 'description' => 'Pterigión'],
            ['code' => 'H11.00', 'description' => 'Pterigión sin especificar'],
            ['code' => 'H11.01', 'description' => 'Pterigión estacionario'],
            ['code' => 'H11.02', 'description' => 'Pterigión progresivo'],
            // Retinopatía diabética
            ['code' => 'H36.0', 'description' => 'Retinopatía diabética'],
            ['code' => 'E11.3', 'description' => 'Diabetes mellitus tipo 2 con complicaciones oftálmicas'],
            // Ambliopía
            ['code' => 'H53.0', 'description' => 'Ambliopía por anopsia'],
            ['code' => 'H53.01', 'description' => 'Ambliopía por privación visual'],
            ['code' => 'H53.02', 'description' => 'Ambliopía por refracción'],
            ['code' => 'H53.03', 'description' => 'Ambliopía por estrabismo'],
            // Nistagmo
            ['code' => 'H55.0', 'description' => 'Nistagmo'],
            ['code' => 'H55.00', 'description' => 'Nistagmo, no especificado'],
            ['code' => 'H55.01', 'description' => 'Nistagmo congénito'],
            // Párpados
            ['code' => 'H02.0', 'description' => 'Entropión y triquiasis palpebral'],
            ['code' => 'H02.1', 'description' => 'Ectropión del párpado'],
            ['code' => 'H02.2', 'description' => 'Lagoftalmos'],
            ['code' => 'H02.3', 'description' => 'Blefarocalasia'],
            ['code' => 'H02.4', 'description' => 'Ptosis palpebral'],
            ['code' => 'H00.0', 'description' => 'Orzuelo y otras inflamaciones profundas del párpado (hordeolum)'],
            ['code' => 'H00.1', 'description' => 'Chalazión'],
            // Nervio óptico
            ['code' => 'H47.0', 'description' => 'Neuritis óptica'],
            ['code' => 'H47.1', 'description' => 'Papiledema'],
            ['code' => 'H47.2', 'description' => 'Atrofia óptica'],
            // Córnea
            ['code' => 'H17.0', 'description' => 'Leucoma adherente'],
            ['code' => 'H18.0', 'description' => 'Pigmentación y depósitos en la córnea'],
            ['code' => 'H18.1', 'description' => 'Queratopatía bullosa'],
            ['code' => 'H18.2', 'description' => 'Otros edemas de la córnea'],
            ['code' => 'H18.3', 'description' => 'Cambios en las membranas de la córnea'],
            ['code' => 'H18.4', 'description' => 'Degeneración de la córnea'],
            ['code' => 'H18.5', 'description' => 'Distrofia hereditaria de la córnea'],
            // Úvea
            ['code' => 'H20.0', 'description' => 'Iridociclitis aguda y subaguda (uveítis anterior aguda)'],
            ['code' => 'H20.1', 'description' => 'Iridociclitis crónica'],
            ['code' => 'H20.2', 'description' => 'Iridociclitis inducida por el cristalino'],
            // Desprendimiento de retina
            ['code' => 'H33.0', 'description' => 'Desprendimiento de retina con desgarro'],
            ['code' => 'H33.3', 'description' => 'Retinosquisis y quistes de retina'],
            ['code' => 'H33.4', 'description' => 'Desprendimiento de retina por tracción'],
            // Visión
            ['code' => 'H54.0', 'description' => 'Ceguera binocular'],
            ['code' => 'H54.1', 'description' => 'Ceguera de un ojo, visión reducida del otro'],
            ['code' => 'H54.2', 'description' => 'Visión reducida binocular'],
            ['code' => 'H54.4', 'description' => 'Ceguera de un ojo'],
            ['code' => 'H54.5', 'description' => 'Visión reducida de un ojo'],
            // Binocular
            ['code' => 'H51.0', 'description' => 'Parálisis de la mirada conjugada'],
            ['code' => 'H51.1', 'description' => 'Insuficiencia de convergencia'],
            ['code' => 'H51.2', 'description' => 'Oftalmoplejía internuclear'],
            // Traumatismos
            ['code' => 'S05.0', 'description' => 'Traumatismo de la conjuntiva y abrasión corneal sin cuerpo extraño'],
            ['code' => 'S05.1', 'description' => 'Contusión del globo ocular y tejidos orbitarios'],
            ['code' => 'T15.0', 'description' => 'Cuerpo extraño en córnea'],
            ['code' => 'T15.1', 'description' => 'Cuerpo extraño en saco conjuntival'],
        ];

        foreach ($codes as $code) {
            Cie10Code::firstOrCreate(['code' => $code['code']], ['description' => $code['description']]);
        }
    }
}
