package com.joyent.piranha.pageobject;

import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class SLBLicense extends AbstractPageObject {
    public void ckeckAcceptLicense(){
        $(".checker").click();
    }

    public LoadBalancers clickInstallButton(){
        $(byText("Install Load Balancer")).click();
        waitForLargeSpinnerDisappear();
        return page(LoadBalancers.class);
    }

}
