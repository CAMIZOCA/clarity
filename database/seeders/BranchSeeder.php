<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Warehouse;
use Illuminate\Database\Seeder;

class BranchSeeder extends Seeder
{
    public function run(): void
    {
        $branch = Branch::firstOrCreate(
            ['code' => 'PRINCIPAL'],
            [
                'name'             => 'Clarity Óptica — Principal',
                'address'          => 'Av. Principal 123',
                'city'             => 'Quito',
                'province'         => 'Pichincha',
                'phone'            => '022345678',
                'is_active'        => true,
                'is_main'          => true,
                'settings'         => json_encode(['iva_rate' => 0.15]),
            ]
        );

        Warehouse::firstOrCreate(
            ['code' => 'PRINCIPAL-BOD1'],
            [
                'branch_id'  => $branch->id,
                'name'       => 'Bodega Principal',
                'type'       => 'principal',
                'is_active'  => true,
                'is_default' => true,
            ]
        );

        $this->command?->info('Sucursal y bodega principal creadas.');
    }
}
