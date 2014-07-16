package com.joyent.piranha.pageobject;


import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class PolicyDetails extends CreatePolicy {
    @Override
    String getTitle() {
        return "Policy Details";
    }

    public Policies clickSave() {
        $("[data-ng-click=\"updatePolicy(true)\"]").click();
        return page(Policies.class);
    }

    public Policies clickDelete() {
        $("[data-ng-click=\"deletePolicy()\"]").click();
        return page(Policies.class);
    }
}
