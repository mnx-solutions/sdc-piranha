package com.joyent.piranha.pageobject;

import com.codeborne.selenide.SelenideElement;

import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class LoadBalancers extends AbstractPageObject {
    public static final String TITLE = "Load Balancers";

    @Override
    String getTitle(){
        return TITLE;
    }

    public SelenideElement getCreateButton(){
        return $("[data-ng-click=\"createNew()\"]");
    }

    public Dashboard clickUninstallButton() {
        $(byText("Uninstall Load Balancer")).click();
        return page(Dashboard.class);
    }

    public EditLoadBalancer clickCreateButton() {
        getCreateButton().click();
        return page(EditLoadBalancer.class);
    }

    public LoadBalancerDetails openFirstLBDetails(){
        $("[data-ng-repeat=\"server in servers\"] td a").click();
        return page(LoadBalancerDetails.class);
    }
}
