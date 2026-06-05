<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RolesSeeder::class,
            BranchSeeder::class,
            AdminUserSeeder::class,
            Cie10Seeder::class,
            ClinicalCatalogSeeder::class,
            MessageTemplateSeeder::class,
        ]);
    }
}
